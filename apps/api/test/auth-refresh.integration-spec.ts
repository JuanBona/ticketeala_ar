// Refresh and logout (D34): rotation, reuse detection, expiry, logout and deactivated employees.
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

describe('POST /auth/refresh and /auth/logout', () => {
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

  async function loginRefreshToken(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employee.email, password: SYNTHETIC_PASSWORD });
    return response.body.refreshToken;
  }

  function refresh(refreshToken: string) {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken });
  }

  it('D34: a valid refresh token returns a new pair with a different refresh token', async () => {
    const firstToken = await loginRefreshToken();

    const response = await refresh(firstToken);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).not.toBe(firstToken);
  });

  it('D34: a refresh token works only once', async () => {
    const firstToken = await loginRefreshToken();
    await refresh(firstToken);

    const response = await refresh(firstToken);

    expect(response.status).toBe(401);
  });

  it('D34: reusing an old refresh token also closes the newest one of that session', async () => {
    const stolenToken = await loginRefreshToken();
    const legitimateRotation = await refresh(stolenToken);

    await refresh(stolenToken);
    const response = await refresh(legitimateRotation.body.refreshToken);

    expect(response.status).toBe(401);
  });

  it('D34: reuse detection does not close other sessions of the same employee', async () => {
    const otherDeviceToken = await loginRefreshToken();
    const stolenToken = await loginRefreshToken();
    await refresh(stolenToken);
    await refresh(stolenToken);

    const response = await refresh(otherDeviceToken);

    expect(response.status).toBe(200);
  });

  it('D34: an expired refresh token is rejected', async () => {
    const refreshToken = await loginRefreshToken();
    await client.refreshSession.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await refresh(refreshToken);

    expect(response.status).toBe(401);
  });

  it('D34: an unknown refresh token is rejected', async () => {
    const response = await refresh('token-que-nunca-existio');

    expect(response.status).toBe(401);
  });

  it('D34: after logout the refresh token no longer works', async () => {
    const refreshToken = await loginRefreshToken();

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken });
    const response = await refresh(refreshToken);

    expect(logout.status).toBe(204);
    expect(response.status).toBe(401);
  });

  it('D34: logout with an unknown refresh token still answers 204', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: 'token-que-nunca-existio' });

    expect(response.status).toBe(204);
  });

  it('RN28: a deactivated employee cannot refresh and loses the session', async () => {
    const refreshToken = await loginRefreshToken();
    await client.employee.update({
      where: { employeeNumber: employee.employeeNumber },
      data: { active: false },
    });

    const response = await refresh(refreshToken);

    expect(response.status).toBe(401);
    const openSessions = await client.refreshSession.count({
      where: { revokedAt: null },
    });
    expect(openSessions).toBe(0);
  });

  it('D34: a role granted after login is in the token issued at the next refresh', async () => {
    const refreshToken = await loginRefreshToken();
    const managementRole = await client.role.create({
      data: { name: 'gerencia' },
    });
    await client.employeeRole.create({
      data: {
        employeeNumber: employee.employeeNumber,
        roleId: managementRole.id,
      },
    });

    const refreshed = await refresh(refreshToken);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`);

    expect(me.body.roles).toContain('gerencia');
  });
});
