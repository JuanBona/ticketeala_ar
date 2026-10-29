// D36: enrollment codes issued by an administrator, recovery codes, and second factor reset.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Role } from '../src/auth/role.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  currentCode,
  enrollSecondFactor,
  issueEnrollmentCode,
  secretFromUri,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const APPROVER_NUMBER = 3001;
const ADMINISTRATOR_NUMBER = 4001;
const RECOVERY_CODE_COUNT = 8;
const UNKNOWN_CODE = 'AAAA-BBBB-CCCC-DDDD';

describe('D36 second factor codes', () => {
  let client: PrismaClient;
  let app: INestApplication;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    app = await createAuthTestApp(client);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  function post(path: string, body: object, accessToken?: string) {
    const call = request(app.getHttpServer()).post(path).send(body);
    return accessToken
      ? call.set('Authorization', `Bearer ${accessToken}`)
      : call;
  }

  /** Step 1 of the login: returns the challenge token. */
  async function passwordStep(employeeNumber: number): Promise<string> {
    const response = await post('/auth/login', {
      email: `empleado.${employeeNumber}@example.com`,
      password: SYNTHETIC_PASSWORD,
    });
    return response.body.challengeToken;
  }

  function enroll(challengeToken: string, enrollmentCode: string) {
    return post('/auth/totp/enroll', { challengeToken, enrollmentCode });
  }

  /** Full first setup of an approver; returns what the employee ends up with. */
  async function enrolledApprover() {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });
    const enrollmentCode = await issueEnrollmentCode(client, APPROVER_NUMBER);
    const started = await enroll(
      await passwordStep(APPROVER_NUMBER),
      enrollmentCode,
    );
    const secret = secretFromUri(started.body.otpauthUri);
    const verified = await post('/auth/totp/verify', {
      challengeToken: started.body.challengeToken,
      code: await currentCode(secret),
    });
    return {
      refreshToken: verified.body.refreshToken as string,
      recoveryCodes: verified.body.recoveryCodes as string[],
    };
  }

  /** An employee with TOTP already set up, logged in with password and code. */
  async function accessTokenWithTotp(
    employeeNumber: number,
    roles: Role[],
  ): Promise<string> {
    await createSyntheticEmployee(client, { employeeNumber, roles });
    const secret = await enrollSecondFactor(client, employeeNumber);
    const verified = await post('/auth/totp/verify', {
      challengeToken: await passwordStep(employeeNumber),
      code: await currentCode(secret),
    });
    return verified.body.accessToken;
  }

  it('D36: setting up TOTP with a code nobody issued is refused', async () => {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });

    const response = await enroll(
      await passwordStep(APPROVER_NUMBER),
      UNKNOWN_CODE,
    );

    expect(response.status).toBe(401);
  });

  it('D36: an expired enrollment code is refused', async () => {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });
    const enrollmentCode = await issueEnrollmentCode(client, APPROVER_NUMBER);
    await client.secondFactorCode.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await enroll(
      await passwordStep(APPROVER_NUMBER),
      enrollmentCode,
    );

    expect(response.status).toBe(401);
  });

  it('D36: a new enrollment code voids the previous one', async () => {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });
    const oldCode = await issueEnrollmentCode(client, APPROVER_NUMBER);
    await issueEnrollmentCode(client, APPROVER_NUMBER);

    const response = await enroll(await passwordStep(APPROVER_NUMBER), oldCode);

    expect(response.status).toBe(401);
  });

  it('D36: an enrollment code sets up TOTP only once', async () => {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });
    const enrollmentCode = await issueEnrollmentCode(client, APPROVER_NUMBER);
    const first = await enroll(
      await passwordStep(APPROVER_NUMBER),
      enrollmentCode,
    );
    const second = await enroll(
      await passwordStep(APPROVER_NUMBER),
      enrollmentCode,
    );
    await post('/auth/totp/verify', {
      challengeToken: first.body.challengeToken,
      code: await currentCode(secretFromUri(first.body.otpauthUri)),
    });

    const response = await post('/auth/totp/verify', {
      challengeToken: second.body.challengeToken,
      code: await currentCode(secretFromUri(second.body.otpauthUri)),
    });

    expect(response.status).toBe(401);
  });

  it('D36: finishing the setup returns 8 recovery codes', async () => {
    const { recoveryCodes } = await enrolledApprover();

    expect(recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(recoveryCodes[0]).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/);
  });

  it('D36: a recovery code logs in once and is recorded in the audit log', async () => {
    const { recoveryCodes } = await enrolledApprover();
    const recoveryCode = recoveryCodes[0];

    const first = await post('/auth/totp/recover', {
      challengeToken: await passwordStep(APPROVER_NUMBER),
      recoveryCode: recoveryCode.toLowerCase(),
    });
    const second = await post('/auth/totp/recover', {
      challengeToken: await passwordStep(APPROVER_NUMBER),
      recoveryCode,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    const audited = await client.auditLog.count({
      where: { action: 'usar_codigo_recuperacion' },
    });
    expect(audited).toBe(1);
  });

  it('D36: an administrator reset removes the TOTP, closes sessions, voids codes and is audited', async () => {
    const approver = await enrolledApprover();
    const adminToken = await accessTokenWithTotp(ADMINISTRATOR_NUMBER, [
      'empleado',
      'administrador',
    ]);

    const response = await post(
      '/auth/totp/enrollment-codes',
      { employeeNumber: APPROVER_NUMBER },
      adminToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.enrollmentCode).toMatch(/^[A-Z2-7-]{19}$/);
    const employee = await client.employee.findUniqueOrThrow({
      where: { employeeNumber: APPROVER_NUMBER },
    });
    expect(employee.totpSecret).toBeNull();
    const refresh = await post('/auth/refresh', {
      refreshToken: approver.refreshToken,
    });
    expect(refresh.status).toBe(401);
    const recover = await post('/auth/totp/recover', {
      challengeToken: await passwordStep(APPROVER_NUMBER),
      recoveryCode: approver.recoveryCodes[0],
    });
    expect(recover.status).toBe(401);
    const entry = await client.auditLog.findFirstOrThrow({
      where: {
        action: 'reiniciar_segundo_factor',
        employeeNumber: ADMINISTRATOR_NUMBER,
      },
    });
    expect(entry.entityId).toBe(String(APPROVER_NUMBER));
  });

  it('D36: an administrator cannot issue a code for themselves', async () => {
    const adminToken = await accessTokenWithTotp(ADMINISTRATOR_NUMBER, [
      'empleado',
      'administrador',
    ]);

    const response = await post(
      '/auth/totp/enrollment-codes',
      { employeeNumber: ADMINISTRATOR_NUMBER },
      adminToken,
    );

    expect(response.status).toBe(403);
  });

  it('D36: only an administrator can issue codes', async () => {
    const approverToken = await accessTokenWithTotp(APPROVER_NUMBER, [
      'empleado',
      'aprobador',
    ]);

    const response = await post(
      '/auth/totp/enrollment-codes',
      { employeeNumber: ADMINISTRATOR_NUMBER },
      approverToken,
    );

    expect(response.status).toBe(403);
  });

  it('D36: a code for an employee without approver, accounting or admin roles is refused', async () => {
    const adminToken = await accessTokenWithTotp(ADMINISTRATOR_NUMBER, [
      'empleado',
      'administrador',
    ]);
    await createSyntheticEmployee(client, {
      employeeNumber: 2001,
      roles: ['empleado'],
    });

    const response = await post(
      '/auth/totp/enrollment-codes',
      { employeeNumber: 2001 },
      adminToken,
    );

    expect(response.status).toBe(400);
  });
});
