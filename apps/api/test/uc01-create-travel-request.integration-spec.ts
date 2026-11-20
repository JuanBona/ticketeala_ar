// UC-01 steps 1 to 6: creating a travel request (RN01, RN02, D03, D11, 3a, 4a) and listing one's own.
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
const DAILY_ALLOWANCE = '10000.00';
const MINIMUM_ADVANCE_DAYS = 5;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** A YYYY-MM-DD date this many days after today in Argentina. */
function daysFromToday(days: number): string {
  const today = Date.parse(`${todayInArgentina(new Date())}T00:00:00Z`);
  return new Date(today + days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

describe('UC-01 create travel request', () => {
  let client: PrismaClient;
  let app: INestApplication;
  let accessToken: string;
  let destinationId: number;
  let policyId: number;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    app = await createAuthTestApp(client);
    accessToken = await loginAs(EMPLOYEE_NUMBER, ['empleado']);
    destinationId = (
      await client.destination.create({
        data: { city: 'Córdoba', country: 'Argentina' },
      })
    ).id;
    policyId = await createPolicy(await categoryOf(EMPLOYEE_NUMBER), {
      version: 1,
    });
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

  async function categoryOf(employeeNumber: number): Promise<number> {
    const employee = await client.employee.findUniqueOrThrow({
      where: { employeeNumber },
    });
    return employee.categoryId;
  }

  /** A synthetic policy for this category and the test destination. */
  async function createPolicy(
    categoryId: number,
    options: { version: number },
  ): Promise<number> {
    const policy = await client.expensePolicy.create({
      data: {
        categoryId,
        destinationId,
        amountCap: '500000.00',
        minimumAdvanceDays: MINIMUM_ADVANCE_DAYS,
        dailyAllowance: DAILY_ALLOWANCE,
        version: options.version,
        authorEmployeeNumber: EMPLOYEE_NUMBER,
      },
    });
    return policy.id;
  }

  /** A valid body: Córdoba in 10 days, 3 nights. Overrides change one field per test. */
  function createRequest(overrides: object = {}, token = accessToken) {
    return request(app.getHttpServer())
      .post('/travel-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationId,
        startDate: daysFromToday(10),
        endDate: daysFromToday(13),
        reason: 'Reunión con proveedores (sintético)',
        ...overrides,
      });
  }

  function listMine(token = accessToken) {
    return request(app.getHttpServer())
      .get('/travel-requests/mine')
      .set('Authorization', `Bearer ${token}`);
  }

  it('UC-01: a valid request starts en_cotizacion with the policy in force', async () => {
    const response = await createRequest();

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('en_cotizacion');
    expect(response.body.policy.id).toBe(policyId);
  });

  it('D03, D11: the estimated allowance is the daily allowance times the nights, and it is stored', async () => {
    const response = await createRequest();

    expect(response.body.nights).toBe(3);
    expect(response.body.estimatedAllowance).toBe('30000.00');
    const allowance = await client.travelAllowance.findUniqueOrThrow({
      where: { travelRequestId: response.body.id },
    });
    expect(allowance.estimatedAmount.toFixed(2)).toBe('30000.00');
  });

  it('D11: a same-day trip has no allowance', async () => {
    const sameDay = daysFromToday(10);

    const response = await createRequest({
      startDate: sameDay,
      endDate: sameDay,
    });

    expect(response.body.estimatedAllowance).toBe('0.00');
  });

  it('RN01: the policy is chosen by the employee category and the destination', async () => {
    const otherCategory = await client.employeeCategory.create({
      data: { name: 'Gerencial' },
    });
    await createPolicy(otherCategory.id, { version: 1 });

    const response = await createRequest();

    expect(response.body.policy.id).toBe(policyId);
  });

  it('RN01: without a policy in force for the destination the request is refused', async () => {
    const elsewhere = await client.destination.create({
      data: { city: 'Mendoza', country: 'Argentina' },
    });

    const response = await createRequest({ destinationId: elsewhere.id });

    expect(response.status).toBe(422);
  });

  it('RN02: an old request keeps its policy after a new version comes into force', async () => {
    const created = await createRequest();
    await client.expensePolicy.update({
      where: { id: policyId },
      data: { validUntil: new Date() },
    });
    const newPolicyId = await createPolicy(await categoryOf(EMPLOYEE_NUMBER), {
      version: 2,
    });

    const mine = await listMine();
    const later = await createRequest();

    expect(mine.body[0]).toMatchObject({
      id: created.body.id,
      policy: { id: policyId, version: 1 },
    });
    expect(later.body.policy.id).toBe(newPolicyId);
  });

  it('4a: too little advance without a justification is refused with a code the app can read', async () => {
    const response = await createRequest({
      startDate: daysFromToday(2),
      endDate: daysFromToday(3),
    });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('ADVANCE_JUSTIFICATION_REQUIRED');
  });

  it('4a: too little advance with a justification is accepted and the justification is kept', async () => {
    const response = await createRequest({
      startDate: daysFromToday(2),
      endDate: daysFromToday(3),
      advanceJustification: 'Reunión convocada de urgencia (sintético)',
    });

    expect(response.status).toBe(201);
    expect(response.body.advanceJustification).toBe(
      'Reunión convocada de urgencia (sintético)',
    );
  });

  it('3a: a start date in the past is refused', async () => {
    const response = await createRequest({ startDate: daysFromToday(-1) });

    expect(response.status).toBe(400);
  });

  it('3a: an end date before the start date is refused', async () => {
    const response = await createRequest({ endDate: daysFromToday(9) });

    expect(response.status).toBe(400);
  });

  it('3a: a request without reason is refused', async () => {
    const response = await createRequest({ reason: '' });

    expect(response.status).toBe(400);
  });

  it('3a: a date with time instead of a calendar date is refused', async () => {
    const response = await createRequest({
      startDate: `${daysFromToday(10)}T10:00:00Z`,
    });

    expect(response.status).toBe(400);
  });

  it('only the employee role can ask for a trip', async () => {
    const agencyToken = await loginAs(2002, ['agencia']);

    const response = await createRequest({}, agencyToken);

    expect(response.status).toBe(403);
  });

  it('each employee sees only their own requests', async () => {
    await createRequest();
    const colleagueToken = await loginAs(2003, ['empleado']);

    const mine = await listMine();
    const theirs = await listMine(colleagueToken);

    expect(mine.body).toHaveLength(1);
    expect(theirs.body).toHaveLength(0);
  });

  it('UC-01 step 2: the destination list is available to any logged-in employee', async () => {
    const response = await request(app.getHttpServer())
      .get('/destinations')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.body).toEqual([
      { id: destinationId, city: 'Córdoba', country: 'Argentina' },
    ]);
  });
});
