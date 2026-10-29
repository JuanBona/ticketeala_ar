// AuditInterceptor (12.4, RNF11): successful @Audited calls land in registro_auditoria with before and after.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const EMPLOYEE_NUMBER = 2001;

describe('AuditInterceptor', () => {
  let client: PrismaClient;
  let app: INestApplication;
  let accessToken: string;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    app = await createAuthTestApp(client);
    // A role without TOTP keeps the setup short; the interceptor does not depend on roles.
    const employee = await createSyntheticEmployee(client, {
      employeeNumber: EMPLOYEE_NUMBER,
      roles: ['empleado', 'gerencia'],
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employee.email, password: SYNTHETIC_PASSWORD });
    accessToken = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  function call(method: 'get' | 'post', path: string) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${accessToken}`);
  }

  it('RNF11: records who changed which record, with the value before and after', async () => {
    await call('post', '/probe/audited-change');

    const entry = await client.auditLog.findFirstOrThrow();
    expect(entry).toMatchObject({
      employeeNumber: EMPLOYEE_NUMBER,
      entity: 'politica_gasto',
      entityId: '7',
      action: 'cerrar_version',
      previousValue: { vigenteHasta: null },
      newValue: { vigenteHasta: '2026-11-01' },
    });
  });

  it('answers the client only the response part, not the audit data', async () => {
    const response = await call('post', '/probe/audited-change');

    expect(response.body).toEqual({ closed: true });
  });

  it('records nothing when the audited operation fails', async () => {
    const response = await call('post', '/probe/audited-failure');

    expect(response.status).toBe(400);
    expect(await client.auditLog.count()).toBe(0);
  });

  it('records nothing for endpoints without @Audited', async () => {
    await call('get', '/probe/any-employee');

    expect(await client.auditLog.count()).toBe(0);
  });

  it('fails loudly when an @Audited endpoint forgets auditedChange()', async () => {
    const response = await call('post', '/probe/audited-without-change');

    expect(response.status).toBe(500);
    expect(await client.auditLog.count()).toBe(0);
  });
});
