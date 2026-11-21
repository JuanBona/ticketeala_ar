// UC-01 steps 7 to 9 and minimal UC-03: the agency loads quotes, the requester compares and selects (RN08–RN11, 9a).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Role } from '../src/auth/role.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { todayInArgentina } from '../src/solicitudes/travel-request-rules.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const EMPLOYEE_NUMBER = 2001;
const ADVISOR_NUMBER = 2002;
const AMOUNT_CAP = '250000.00';
const SUPPLIER_CUIT = '30712345678';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** A YYYY-MM-DD date this many days after today in Argentina. */
function daysFromToday(days: number): string {
  const today = Date.parse(`${todayInArgentina(new Date())}T00:00:00Z`);
  return new Date(today + days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

describe('UC-01 quotes and selection', () => {
  let client: PrismaClient;
  let app: INestApplication;
  let employeeToken: string;
  let advisorToken: string;
  let travelRequestId: number;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    app = await createAuthTestApp(client);
    employeeToken = await loginAs(EMPLOYEE_NUMBER, ['empleado']);
    advisorToken = await loginAs(ADVISOR_NUMBER, ['agencia']);
    await client.supplier.create({
      data: { cuit: SUPPLIER_CUIT, legalName: 'Aerolínea (sintético)' },
    });
    travelRequestId = await createTravelRequest();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function loginAs(
    employeeNumber: number,
    roles: Role[],
  ): Promise<string> {
    const employee = await createSyntheticEmployee(client, {
      employeeNumber,
      roles,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employee.email, password: SYNTHETIC_PASSWORD });
    return login.body.accessToken;
  }

  /** A synthetic policy for the employee's category and a request through the real endpoint. */
  async function createTravelRequest(): Promise<number> {
    const employee = await client.employee.findUniqueOrThrow({
      where: { employeeNumber: EMPLOYEE_NUMBER },
    });
    const destination = await client.destination.create({
      data: { city: 'Córdoba', country: 'Argentina' },
    });
    await client.expensePolicy.create({
      data: {
        categoryId: employee.categoryId,
        destinationId: destination.id,
        amountCap: AMOUNT_CAP,
        version: 1,
        authorEmployeeNumber: EMPLOYEE_NUMBER,
      },
    });
    const created = await request(app.getHttpServer())
      .post('/travel-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        destinationId: destination.id,
        startDate: daysFromToday(10),
        endDate: daysFromToday(13),
        reason: 'Capacitación (sintético)',
      });
    return created.body.id;
  }

  /** An agency quote for the request; overrides change one field per test. */
  function addQuote(overrides: object = {}, token = advisorToken) {
    return request(app.getHttpServer())
      .post(`/travel-requests/${travelRequestId}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        origin: 'agencia',
        description: 'Vuelo ida y vuelta y 3 noches de hotel (sintético)',
        amount: 180000,
        supplierCuit: SUPPLIER_CUIT,
        validUntil: daysFromToday(5),
        ...overrides,
      });
  }

  function compare(token = employeeToken) {
    return request(app.getHttpServer())
      .get(`/travel-requests/${travelRequestId}/quotes`)
      .set('Authorization', `Bearer ${token}`);
  }

  function select(body: object) {
    return request(app.getHttpServer())
      .post(`/travel-requests/${travelRequestId}/selection`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(body);
  }

  it('UC-03 steps 1–2: the agency tray lists the requests waiting for quotes', async () => {
    const response = await request(app.getHttpServer())
      .get('/travel-requests/quoting')
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(response.body.map((item: { id: number }) => item.id)).toEqual([
      travelRequestId,
    ]);
  });

  it('UC-03 step 6: an agency quote is stored with origin agencia', async () => {
    const response = await addQuote();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      origin: 'agencia',
      amount: '180000.00',
      exceedsCap: false,
    });
  });

  it('UC-03 5a: a quote over the cap is stored but flagged', async () => {
    const response = await addQuote({ amount: 300000 });

    expect(response.status).toBe(201);
    expect(response.body.exceedsCap).toBe(true);
  });

  it('UC-03 step 7: an external reference without its source is refused', async () => {
    const response = await addQuote({
      origin: 'externa',
      supplierCuit: undefined,
    });

    expect(response.status).toBe(400);
  });

  it('UC-03 step 5: an agency quote without fare validity is refused', async () => {
    const response = await addQuote({ validUntil: undefined });

    expect(response.status).toBe(400);
  });

  it('UC-03 6a: a fare validity already past is refused', async () => {
    const response = await addQuote({ validUntil: daysFromToday(-1) });

    expect(response.status).toBe(400);
  });

  it('UC-03: a supplier CUIT that is not registered is refused', async () => {
    const response = await addQuote({ supplierCuit: '20111111112' });

    expect(response.status).toBe(400);
  });

  it('UC-03: only the agency loads quotes', async () => {
    const response = await addQuote({}, employeeToken);

    expect(response.status).toBe(403);
  });

  it('UC-03: a request no longer en_cotizacion does not accept quotes', async () => {
    await client.travelRequest.update({
      where: { id: travelRequestId },
      data: { status: 'CANCELLED' },
    });

    const response = await addQuote();

    expect(response.status).toBe(409);
  });

  it('UC-01 step 8: the comparison shows the cap, the cheapest external and the savings', async () => {
    await addQuote();
    await addQuote({
      origin: 'externa',
      amount: 200000,
      source: 'Sitio de la aerolínea',
      validUntil: undefined,
    });

    const response = await compare();

    expect(response.body).toMatchObject({
      amountCap: AMOUNT_CAP,
      lowestExternalAmount: '200000.00',
    });
    const agencyQuote = response.body.quotes.find(
      (quote: { origin: string }) => quote.origin === 'agencia',
    );
    expect(agencyQuote.savingsAgainstExternal).toBe('20000.00');
  });

  it('UC-01 step 8: only the requester sees the comparison', async () => {
    const colleagueToken = await loginAs(2003, ['empleado']);

    const response = await compare(colleagueToken);

    expect(response.status).toBe(403);
  });

  it('UC-01 step 9: selecting an agency quote within the cap marks it selected', async () => {
    const quote = await addQuote();

    const response = await select({ quoteId: quote.body.id });

    expect(response.status).toBe(201);
    expect(response.body.quotes[0]).toMatchObject({
      id: quote.body.id,
      selected: true,
    });
  });

  it('UC-01 step 9: choosing again replaces the previous choice', async () => {
    const first = await addQuote();
    const second = await addQuote({ amount: 170000 });
    await select({ quoteId: first.body.id });

    await select({ quoteId: second.body.id });

    const selected = await client.quote.findMany({
      where: { travelRequestId, selected: true },
    });
    expect(selected.map((quote) => quote.id)).toEqual([second.body.id]);
  });

  it('RN10: an external reference cannot be selected', async () => {
    const external = await addQuote({
      origin: 'externa',
      source: 'Sitio de la aerolínea',
    });

    const response = await select({ quoteId: external.body.id });

    expect(response.status).toBe(400);
  });

  it('RN11: a quote whose fare expired cannot be selected', async () => {
    const quote = await addQuote();
    await client.quote.update({
      where: { id: quote.body.id },
      data: { validUntil: new Date(daysFromToday(-1)) },
    });

    const response = await select({ quoteId: quote.body.id });

    expect(response.status).toBe(422);
  });

  it('9a: a quote over the cap without justification is refused with a code the app can read', async () => {
    const quote = await addQuote({ amount: 300000 });

    const response = await select({ quoteId: quote.body.id });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('OVER_CAP_JUSTIFICATION_REQUIRED');
  });

  it('9a: with a justification the over-cap quote is selected and the justification kept', async () => {
    const quote = await addQuote({ amount: 300000 });

    await select({
      quoteId: quote.body.id,
      overCapJustification: 'Única opción con vuelo directo (sintético)',
    });

    const stored = await client.travelRequest.findUniqueOrThrow({
      where: { id: travelRequestId },
    });
    expect(stored.overCapJustification).toBe(
      'Única opción con vuelo directo (sintético)',
    );
  });

  it('9a: switching to a quote within the cap clears the old justification', async () => {
    const expensive = await addQuote({ amount: 300000 });
    const cheaper = await addQuote();
    await select({
      quoteId: expensive.body.id,
      overCapJustification: 'Vuelo directo (sintético)',
    });

    await select({ quoteId: cheaper.body.id });

    const stored = await client.travelRequest.findUniqueOrThrow({
      where: { id: travelRequestId },
    });
    expect(stored.overCapJustification).toBeNull();
  });
});
