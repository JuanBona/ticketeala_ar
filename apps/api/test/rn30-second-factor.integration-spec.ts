// RN30: approver, accounting and administrator log in with password plus TOTP; enrollment, replay and limits.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  ACCESS_TOKEN_AUDIENCE,
  SECOND_FACTOR_CHALLENGE_AUDIENCE,
} from '../src/auth/auth.constants.js';
import { readJwtSecret } from '../src/auth/jwt-secret.js';
import type { Role } from '../src/auth/role.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  currentCode,
  enrollSecondFactor,
  secretFromUri,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const APPROVER_NUMBER = 3001;
const TOTP_ATTEMPTS_PER_MINUTE = 5;
const ONE_MINUTE_AGO_IN_SECONDS = Math.floor(Date.now() / 1000) - 60;

/** A code that is not the current one: each digit shifted by one. */
function wrongCode(code: string): string {
  return code.replace(/\d/g, (digit) => String((Number(digit) + 1) % 10));
}

describe('RN30 second factor', () => {
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

  async function login(employeeNumber: number, roles: Role[]) {
    const employee = await createSyntheticEmployee(client, {
      employeeNumber,
      roles,
    });
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employee.email, password: SYNTHETIC_PASSWORD });
  }

  function loginAgain(employeeNumber: number) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `empleado.${employeeNumber}@example.com`,
        password: SYNTHETIC_PASSWORD,
      });
  }

  function verify(challengeToken: string, code: string) {
    return request(app.getHttpServer())
      .post('/auth/totp/verify')
      .send({ challengeToken, code });
  }

  function me(accessToken: string) {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  it('RN30: roles outside approver, accounting and administrator get in with the password alone', async () => {
    const response = await login(2001, ['empleado', 'gerencia']);

    expect(response.body.step).toBe('authenticated');
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it.each(['aprobador', 'contaduria', 'administrador'] as const)(
    'RN30: %s without a second factor is asked to set it up and gets no access token',
    async (role) => {
      const response = await login(APPROVER_NUMBER, ['empleado', role]);

      expect(response.body.step).toBe('totp_enrollment_required');
      expect(response.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
      expect(response.body.accessToken).toBeUndefined();
    },
  );

  it('RN30: the first valid code stores the secret encrypted and opens a session with second factor', async () => {
    const enrollment = await login(APPROVER_NUMBER, ['empleado', 'aprobador']);
    const secret = secretFromUri(enrollment.body.otpauthUri);

    const response = await verify(
      enrollment.body.challengeToken,
      await currentCode(secret),
    );

    expect(response.status).toBe(200);
    const employee = await client.employee.findUniqueOrThrow({
      where: { employeeNumber: APPROVER_NUMBER },
    });
    expect(employee.totpSecret).not.toBeNull();
    expect(employee.totpSecret).not.toContain(secret);
    const profile = await me(response.body.accessToken);
    expect(profile.body.secondFactorVerified).toBe(true);
  });

  it('RN30: activating the second factor is recorded in the audit log', async () => {
    const enrollment = await login(APPROVER_NUMBER, ['empleado', 'aprobador']);
    const secret = secretFromUri(enrollment.body.otpauthUri);

    await verify(enrollment.body.challengeToken, await currentCode(secret));

    const entry = await client.auditLog.findFirstOrThrow();
    expect(entry).toMatchObject({
      employeeNumber: APPROVER_NUMBER,
      entity: 'empleado',
      entityId: String(APPROVER_NUMBER),
      action: 'activar_segundo_factor',
      previousValue: { segundoFactorActivo: false },
      newValue: { segundoFactorActivo: true },
    });
  });

  it('RN30: a wrong code at enrollment stores no secret', async () => {
    const enrollment = await login(APPROVER_NUMBER, ['empleado', 'aprobador']);
    const secret = secretFromUri(enrollment.body.otpauthUri);

    const response = await verify(
      enrollment.body.challengeToken,
      wrongCode(await currentCode(secret)),
    );

    expect(response.status).toBe(401);
    const employee = await client.employee.findUniqueOrThrow({
      where: { employeeNumber: APPROVER_NUMBER },
    });
    expect(employee.totpSecret).toBeNull();
  });

  it('RN30: an enrolled approver gets in only after sending the current code', async () => {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });
    const secret = await enrollSecondFactor(client, APPROVER_NUMBER);

    const firstStep = await loginAgain(APPROVER_NUMBER);
    const secondStep = await verify(
      firstStep.body.challengeToken,
      await currentCode(secret),
    );

    expect(firstStep.body.step).toBe('totp_required');
    expect(firstStep.body.accessToken).toBeUndefined();
    expect(secondStep.status).toBe(200);
    expect(secondStep.body.accessToken).toEqual(expect.any(String));
  });

  it('D35: the same code cannot be used twice', async () => {
    await createSyntheticEmployee(client, {
      employeeNumber: APPROVER_NUMBER,
      roles: ['empleado', 'aprobador'],
    });
    const secret = await enrollSecondFactor(client, APPROVER_NUMBER);
    const code = await currentCode(secret);
    const firstLogin = await loginAgain(APPROVER_NUMBER);
    await verify(firstLogin.body.challengeToken, code);

    const secondLogin = await loginAgain(APPROVER_NUMBER);
    const response = await verify(secondLogin.body.challengeToken, code);

    expect(response.status).toBe(401);
  });

  it('RN30: the challenge token does not open endpoints', async () => {
    const enrollment = await login(APPROVER_NUMBER, ['empleado', 'aprobador']);

    const response = await me(enrollment.body.challengeToken);

    expect(response.status).toBe(401);
  });

  it('RN30: an access token is not accepted as a challenge', async () => {
    const employeeLogin = await login(2001, ['empleado']);

    const response = await verify(employeeLogin.body.accessToken, '123456');

    expect(response.status).toBe(401);
  });

  it('RN30: an expired challenge is rejected', async () => {
    const expiredChallenge = await new JwtService({
      secret: readJwtSecret(),
    }).signAsync(
      { sub: String(APPROVER_NUMBER), exp: ONE_MINUTE_AGO_IN_SECONDS },
      { audience: SECOND_FACTOR_CHALLENGE_AUDIENCE },
    );

    const response = await verify(expiredChallenge, '123456');

    expect(response.status).toBe(401);
  });

  it('RN30: an access token with an approver role but no second factor is rejected', async () => {
    const forgedWithRealKey = await new JwtService({
      secret: readJwtSecret(),
    }).signAsync(
      {
        sub: String(APPROVER_NUMBER),
        roles: ['aprobador'],
        secondFactorVerified: false,
      },
      { audience: ACCESS_TOKEN_AUDIENCE },
    );

    const response = await me(forgedWithRealKey);

    expect(response.status).toBe(401);
  });

  it('RN30: an approver role granted after a password-only login closes the session at the next refresh', async () => {
    const employeeLogin = await login(2001, ['empleado']);
    const approverRole = await client.role.create({
      data: { name: 'aprobador' },
    });
    await client.employeeRole.create({
      data: { employeeNumber: 2001, roleId: approverRole.id },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: employeeLogin.body.refreshToken });

    expect(response.status).toBe(401);
  });

  it('RN30: the sixth code within a minute for one employee is refused', async () => {
    const enrollment = await login(APPROVER_NUMBER, ['empleado', 'aprobador']);
    const secret = secretFromUri(enrollment.body.otpauthUri);
    const code = await currentCode(secret);
    for (let attempt = 0; attempt < TOTP_ATTEMPTS_PER_MINUTE; attempt++) {
      await verify(enrollment.body.challengeToken, wrongCode(code));
    }

    const response = await verify(enrollment.body.challengeToken, code);

    expect(response.status).toBe(429);
  });
});
