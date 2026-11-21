// UC-01 steps 9 to 13, 9a, 9b, 10a and 12a: confirm, approver assignment (D15, D41), approve, reject, cancel.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Role } from '../src/auth/role.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { todayInArgentina } from '../src/solicitudes/travel-request-rules.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  currentCode,
  enrollSecondFactor,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

// Synthetic hierarchy: requester → supervisor → manager; the supervisor's substitute is another approver.
const REQUESTER = 2001;
const SUPERVISOR = 3001;
const MANAGER = 3000;
const SUBSTITUTE = 3002;
const ADVISOR = 2002;
const AMOUNT_CAP = '250000.00';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function daysFromToday(days: number): string {
  const today = Date.parse(`${todayInArgentina(new Date())}T00:00:00Z`);
  return new Date(today + days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

describe('UC-01 approval', () => {
  let client: PrismaClient;
  let app: INestApplication;
  let requesterToken: string;
  let advisorToken: string;
  let travelRequestId: number;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    app = await createAuthTestApp(client);
    await createHierarchy();
    requesterToken = await passwordLogin(REQUESTER);
    advisorToken = await passwordLogin(ADVISOR);
    travelRequestId = await createTravelRequest();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function createHierarchy(): Promise<void> {
    const people: [number, Role[]][] = [
      [MANAGER, ['empleado', 'aprobador']],
      [SUPERVISOR, ['empleado', 'aprobador']],
      [SUBSTITUTE, ['empleado', 'aprobador']],
      [REQUESTER, ['empleado']],
      [ADVISOR, ['agencia']],
    ];
    for (const [employeeNumber, roles] of people) {
      await createSyntheticEmployee(client, { employeeNumber, roles });
    }
    await client.employee.update({
      where: { employeeNumber: SUPERVISOR },
      data: {
        supervisorEmployeeNumber: MANAGER,
        substituteEmployeeNumber: SUBSTITUTE,
      },
    });
    const requester = await client.employee.update({
      where: { employeeNumber: REQUESTER },
      data: { supervisorEmployeeNumber: SUPERVISOR },
    });
    await client.area.update({
      where: { id: requester.areaId },
      data: { managerEmployeeNumber: MANAGER },
    });
  }

  async function passwordLogin(employeeNumber: number): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `empleado.${employeeNumber}@example.com`,
        password: SYNTHETIC_PASSWORD,
      });
    return login.body.accessToken;
  }

  /** Approvers hold an RN30 role: password plus TOTP code. */
  async function approverLogin(employeeNumber: number): Promise<string> {
    const secret = await enrollSecondFactor(client, employeeNumber);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `empleado.${employeeNumber}@example.com`,
        password: SYNTHETIC_PASSWORD,
      });
    const verified = await request(app.getHttpServer())
      .post('/auth/totp/verify')
      .send({
        challengeToken: login.body.challengeToken,
        code: await currentCode(secret),
      });
    return verified.body.accessToken;
  }

  async function createTravelRequest(): Promise<number> {
    const requester = await client.employee.findUniqueOrThrow({
      where: { employeeNumber: REQUESTER },
    });
    const destination = await client.destination.create({
      data: { city: 'Córdoba', country: 'Argentina' },
    });
    await client.expensePolicy.create({
      data: {
        categoryId: requester.categoryId,
        destinationId: destination.id,
        amountCap: AMOUNT_CAP,
        version: 1,
        authorEmployeeNumber: MANAGER,
      },
    });
    const created = await post('/travel-requests', requesterToken, {
      destinationId: destination.id,
      startDate: daysFromToday(10),
      endDate: daysFromToday(13),
      reason: 'Capacitación (sintético)',
    });
    return created.body.id;
  }

  /** The approver's tray. Log in first: awaiting inside a supertest chain breaks its server. */
  async function tray(employeeNumber: number) {
    const token = await approverLogin(employeeNumber);
    return request(app.getHttpServer())
      .get('/travel-requests/to-approve')
      .set('Authorization', `Bearer ${token}`);
  }

  function post(path: string, token: string, body: object = {}) {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  /** The agency quotes `amount` and the requester selects it (with a justification if over the cap). */
  async function chooseQuote(amount: number): Promise<void> {
    const quote = await post(
      `/travel-requests/${travelRequestId}/quotes`,
      advisorToken,
      {
        origin: 'agencia',
        description: 'Vuelo y hotel (sintético)',
        amount,
        validUntil: daysFromToday(5),
      },
    );
    await post(
      `/travel-requests/${travelRequestId}/selection`,
      requesterToken,
      {
        quoteId: quote.body.id,
        overCapJustification: 'Única opción disponible (sintético)',
      },
    );
  }

  function confirm() {
    return post(
      `/travel-requests/${travelRequestId}/confirmation`,
      requesterToken,
    );
  }

  it('UC-01 step 10: confirming with a chosen quote makes it pendiente for the direct supervisor', async () => {
    await chooseQuote(180000);

    const response = await confirm();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'pendiente',
      approverEmployeeNumber: SUPERVISOR,
    });
  });

  it('RN09: a request cannot be confirmed without a chosen agency quote', async () => {
    const response = await confirm();

    expect(response.status).toBe(422);
  });

  it('9a: over the cap the approval goes one level up, to the supervisor of the supervisor', async () => {
    await chooseQuote(300000);

    const response = await confirm();

    expect(response.body.approverEmployeeNumber).toBe(MANAGER);
  });

  it('9a: without a supervisor above, the approval goes to the area manager', async () => {
    await client.employee.update({
      where: { employeeNumber: SUPERVISOR },
      data: { supervisorEmployeeNumber: null },
    });
    await chooseQuote(300000);

    const response = await confirm();

    expect(response.body.approverEmployeeNumber).toBe(MANAGER);
  });

  it('10a: a deactivated approver hands over to the configured substitute', async () => {
    await client.employee.update({
      where: { employeeNumber: SUPERVISOR },
      data: { active: false },
    });
    await chooseQuote(180000);

    const response = await confirm();

    expect(response.body.approverEmployeeNumber).toBe(SUBSTITUTE);
  });

  it('9a: a selection racing a confirmation can never leave an over-cap quote with the direct supervisor', async () => {
    await chooseQuote(180000);
    const expensive = await post(
      `/travel-requests/${travelRequestId}/quotes`,
      advisorToken,
      {
        origin: 'agencia',
        description: 'Vuelo directo (sintético)',
        amount: 300000,
        validUntil: daysFromToday(5),
      },
    );

    // Both at once: whichever wins, the result must respect 9a.
    await Promise.all([
      confirm(),
      post(`/travel-requests/${travelRequestId}/selection`, requesterToken, {
        quoteId: expensive.body.id,
        overCapJustification: 'Vuelo directo (sintético)',
      }),
    ]);

    const stored = await client.travelRequest.findUniqueOrThrow({
      where: { id: travelRequestId },
    });
    const selected = await client.quote.findFirstOrThrow({
      where: { travelRequestId, selected: true },
    });
    const expectedApprover =
      selected.id === expensive.body.id ? MANAGER : SUPERVISOR;
    expect(stored.status).toBe('PENDING');
    expect(stored.approverEmployeeNumber).toBe(expectedApprover);
  });

  it('R02: a deactivated approver without substitute leaves the request unconfirmed', async () => {
    await client.employee.update({
      where: { employeeNumber: SUPERVISOR },
      data: { active: false, substituteEmployeeNumber: null },
    });
    await chooseQuote(180000);

    const response = await confirm();

    expect(response.status).toBe(422);
  });

  it('UC-01 step 12: the tray lists the request only for its assigned approver', async () => {
    await chooseQuote(180000);
    await confirm();

    const supervisorTray = await tray(SUPERVISOR);
    const managerTray = await tray(MANAGER);

    expect(supervisorTray.body).toHaveLength(1);
    expect(supervisorTray.body[0].selectedQuote).toMatchObject({
      amount: '180000.00',
      selected: true,
    });
    expect(managerTray.body).toHaveLength(0);
  });

  it('UC-01 step 13: the assigned approver approves and the approval is audited (RNF11)', async () => {
    await chooseQuote(180000);
    await confirm();

    const response = await post(
      `/travel-requests/${travelRequestId}/approval`,
      await approverLogin(SUPERVISOR),
    );

    expect(response.body.status).toBe('aprobada');
    const entry = await client.auditLog.findFirstOrThrow({
      where: { action: 'aprobar' },
    });
    expect(entry).toMatchObject({
      employeeNumber: SUPERVISOR,
      entity: 'solicitud_viaje',
      entityId: String(travelRequestId),
      previousValue: { estado: 'pendiente' },
      newValue: { estado: 'aprobada' },
    });
  });

  it('12a: a rejection needs a reason, which the employee sees, and is audited', async () => {
    await chooseQuote(180000);
    await confirm();
    const supervisorToken = await approverLogin(SUPERVISOR);

    const withoutReason = await post(
      `/travel-requests/${travelRequestId}/rejection`,
      supervisorToken,
    );
    const rejected = await post(
      `/travel-requests/${travelRequestId}/rejection`,
      supervisorToken,
      {
        reason: 'Fechas superpuestas con el cierre (sintético)',
      },
    );

    expect(withoutReason.status).toBe(400);
    expect(rejected.body).toMatchObject({
      status: 'rechazada',
      rejectionReason: 'Fechas superpuestas con el cierre (sintético)',
    });
    expect(await client.auditLog.count({ where: { action: 'rechazar' } })).toBe(
      1,
    );
  });

  it('only the assigned approver decides, even if another one holds the role', async () => {
    await chooseQuote(180000);
    await confirm();

    const response = await post(
      `/travel-requests/${travelRequestId}/approval`,
      await approverLogin(MANAGER),
    );

    expect(response.status).toBe(403);
  });

  it('a request already approved cannot be approved again', async () => {
    await chooseQuote(180000);
    await confirm();
    const supervisorToken = await approverLogin(SUPERVISOR);
    await post(`/travel-requests/${travelRequestId}/approval`, supervisorToken);

    const response = await post(
      `/travel-requests/${travelRequestId}/approval`,
      supervisorToken,
    );

    expect(response.status).toBe(409);
  });

  it('9b: the requester cancels a request still en_cotizacion', async () => {
    const response = await post(
      `/travel-requests/${travelRequestId}/cancellation`,
      requesterToken,
    );

    expect(response.body.status).toBe('cancelada');
  });

  it('9b: the requester cancels a pendiente request and it leaves the approver tray', async () => {
    await chooseQuote(180000);
    await confirm();

    await post(
      `/travel-requests/${travelRequestId}/cancellation`,
      requesterToken,
    );

    const supervisorTray = await tray(SUPERVISOR);
    expect(supervisorTray.body).toHaveLength(0);
  });

  it('9b: an approved request can no longer be cancelled', async () => {
    await chooseQuote(180000);
    await confirm();
    await post(
      `/travel-requests/${travelRequestId}/approval`,
      await approverLogin(SUPERVISOR),
    );

    const response = await post(
      `/travel-requests/${travelRequestId}/cancellation`,
      requesterToken,
    );

    expect(response.status).toBe(409);
  });

  it('only the requester confirms or cancels their request', async () => {
    const colleague = await createSyntheticEmployee(client, {
      employeeNumber: 2003,
      roles: ['empleado'],
    });
    const colleagueToken = await passwordLogin(colleague.employeeNumber);

    const response = await post(
      `/travel-requests/${travelRequestId}/cancellation`,
      colleagueToken,
    );

    expect(response.status).toBe(403);
  });
});
