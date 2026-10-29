// Login (D12, D34): argon2 password check, inactive employees (RN28), input validation and attempt limit.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  SYNTHETIC_PASSWORD,
  type SyntheticEmployee,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const LOGIN_ATTEMPTS_PER_MINUTE = 5;

describe('POST /auth/login', () => {
  let client: PrismaClient;
  let app: INestApplication;
  let employee: SyntheticEmployee;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    employee = await createSyntheticEmployee(client, {
      employeeNumber: 2001,
      roles: ['empleado'],
    });
    app = await createAuthTestApp(client);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
  }

  it('D12: the right password returns an access token and a refresh token', async () => {
    const response = await login(employee.email, SYNTHETIC_PASSWORD);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.expiresInSeconds).toBe(15 * 60);
  });

  it('D12: the email is matched ignoring case and surrounding spaces', async () => {
    const response = await login(
      `  ${employee.email.toUpperCase()} `,
      SYNTHETIC_PASSWORD,
    );

    expect(response.status).toBe(200);
  });

  it('D12: a wrong password and an unknown email get the same answer', async () => {
    const wrongPassword = await login(employee.email, 'otra-clave');
    const unknownEmail = await login('nadie@example.com', SYNTHETIC_PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('RN28: a deactivated employee cannot log in', async () => {
    await client.employee.update({
      where: { employeeNumber: employee.employeeNumber },
      data: { active: false },
    });

    const response = await login(employee.email, SYNTHETIC_PASSWORD);

    expect(response.status).toBe(401);
  });

  it('D34: the session is stored as a hash, never as the token itself', async () => {
    const response = await login(employee.email, SYNTHETIC_PASSWORD);

    const session = await client.refreshSession.findFirstOrThrow();
    expect(session.tokenHash).not.toBe(response.body.refreshToken);
    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a body with fields the endpoint does not know', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: employee.email,
        password: SYNTHETIC_PASSWORD,
        roles: ['administrador'],
      });

    expect(response.status).toBe(400);
  });

  it('D34: the sixth attempt within a minute for the same email is refused', async () => {
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_MINUTE; attempt++) {
      await login(employee.email, 'otra-clave');
    }

    const response = await login(employee.email, SYNTHETIC_PASSWORD);

    expect(response.status).toBe(429);
  });

  it('D34: the attempt limit of one email does not block another email', async () => {
    const colleague = await createSyntheticEmployee(client, {
      employeeNumber: 2002,
      roles: ['empleado'],
    });
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_MINUTE; attempt++) {
      await login(employee.email, 'otra-clave');
    }

    const response = await login(colleague.email, SYNTHETIC_PASSWORD);

    expect(response.status).toBe(200);
  });
});
