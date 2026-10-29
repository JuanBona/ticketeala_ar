// Global guards (D12, 12.4): every endpoint needs a valid token, and @Roles limits who gets in.
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { readJwtSecret } from '../src/auth/jwt-secret.js';
import type { Role } from '../src/auth/role.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const ONE_MINUTE_AGO_IN_SECONDS = Math.floor(Date.now() / 1000) - 60;

describe('global authentication and role guards', () => {
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

  async function accessTokenFor(employeeNumber: number, roles: Role[]) {
    const employee = await createSyntheticEmployee(client, {
      employeeNumber,
      roles,
    });
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employee.email, password: SYNTHETIC_PASSWORD });
    return response.body.accessToken as string;
  }

  function getWithToken(path: string, accessToken: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${accessToken}`);
  }

  it('D12: an endpoint without @Public rejects a request with no token', async () => {
    const response = await request(app.getHttpServer()).get(
      '/probe/any-employee',
    );

    expect(response.status).toBe(401);
  });

  it('D12: a valid token opens an endpoint without @Roles', async () => {
    const accessToken = await accessTokenFor(2001, ['empleado']);

    const response = await getWithToken('/probe/any-employee', accessToken);

    expect(response.status).toBe(200);
  });

  it('D12: /auth/me returns the employee number and roles of the token', async () => {
    const accessToken = await accessTokenFor(2001, ['empleado', 'contaduria']);

    const response = await getWithToken('/auth/me', accessToken);

    expect(response.body).toEqual({
      employeeNumber: 2001,
      roles: expect.arrayContaining(['empleado', 'contaduria']),
    });
  });

  it('D12: a token with an altered payload is rejected', async () => {
    const accessToken = await accessTokenFor(2001, ['empleado']);
    const [header, , signature] = accessToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: '2001', roles: ['administrador'] }),
    ).toString('base64url');

    const response = await getWithToken(
      '/probe/any-employee',
      `${header}.${forgedPayload}.${signature}`,
    );

    expect(response.status).toBe(401);
  });

  it('D12: an unsigned token declaring algorithm "none" is rejected', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: '2001', roles: ['administrador'] }),
    ).toString('base64url');

    const response = await getWithToken(
      '/probe/any-employee',
      `${header}.${payload}.`,
    );

    expect(response.status).toBe(401);
  });

  it('D34: an expired access token is rejected', async () => {
    const expiredToken = await new JwtService({
      secret: readJwtSecret(),
    }).signAsync({
      sub: '2001',
      roles: ['empleado'],
      exp: ONE_MINUTE_AGO_IN_SECONDS,
    });

    const response = await getWithToken('/probe/any-employee', expiredToken);

    expect(response.status).toBe(401);
  });

  it('12.4: an employee without the required role gets 403', async () => {
    const accessToken = await accessTokenFor(2001, ['empleado']);

    const response = await getWithToken('/probe/accounting-only', accessToken);

    expect(response.status).toBe(403);
  });

  it('RN29: holding the required role among several is enough', async () => {
    const accessToken = await accessTokenFor(2001, ['empleado', 'contaduria']);

    const response = await getWithToken('/probe/accounting-only', accessToken);

    expect(response.status).toBe(200);
  });
});
