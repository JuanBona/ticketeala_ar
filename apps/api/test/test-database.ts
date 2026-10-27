// Helpers for integration tests: a Prisma client on the test database and minimal synthetic fixtures.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const SYNTHETIC_PASSWORD_HASH = 'synthetic-not-a-real-hash';

export function createTestClient(): PrismaClient {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      'Falta TEST_DATABASE_URL en apps/api/.env (ver .env.example)',
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
  });
}

/** Empties every table except Prisma's migration history, so each test starts clean. */
export async function truncateAllTables(client: PrismaClient): Promise<void> {
  const tables = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tableList = tables.map((table) => `"${table.tablename}"`).join(', ');
  await client.$executeRawUnsafe(
    `TRUNCATE ${tableList} RESTART IDENTITY CASCADE`,
  );
}

export interface BaseFixture {
  employeeNumber: number;
  categoryId: number;
  destinationId: number;
  policyId: number;
}

/** Creates one synthetic employee with category, area, destination and a policy in force. */
export async function createBaseFixture(
  client: PrismaClient,
): Promise<BaseFixture> {
  const category = await client.employeeCategory.create({
    data: { name: 'Sintética' },
  });
  const area = await client.area.create({ data: { name: 'Área sintética' } });
  const employee = await client.employee.create({
    data: {
      employeeNumber: 1001,
      fullName: 'Empleado Sintético',
      email: 'empleado.sintetico@example.com',
      categoryId: category.id,
      areaId: area.id,
      passwordHash: SYNTHETIC_PASSWORD_HASH,
    },
  });
  const destination = await client.destination.create({
    data: { city: 'Ciudad Sintética', country: 'Argentina' },
  });
  const policy = await client.expensePolicy.create({
    data: {
      categoryId: category.id,
      destinationId: destination.id,
      amountCap: '100000.00',
      version: 1,
      authorEmployeeNumber: employee.employeeNumber,
    },
  });
  return {
    employeeNumber: employee.employeeNumber,
    categoryId: category.id,
    destinationId: destination.id,
    policyId: policy.id,
  };
}

/** Creates a synthetic travel request from 2026-11-10 to 2026-11-12 under the base fixture. */
export async function createTravelRequest(
  client: PrismaClient,
  base: BaseFixture,
): Promise<number> {
  const travelRequest = await client.travelRequest.create({
    data: {
      employeeNumber: base.employeeNumber,
      destinationId: base.destinationId,
      policyId: base.policyId,
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-12'),
    },
  });
  return travelRequest.id;
}

/** Initial engine parameter values from D20, D21 and D23 (docs/decisiones.md, D24). */
export const INITIAL_ENGINE_PARAMETERS = {
  acceptanceThreshold: 80,
  alertThreshold: 50,
  maximumImageAttempts: 3,
  maximumQueueRetries: 3,
};

export type EngineParameterValues = typeof INITIAL_ENGINE_PARAMETERS;

/** Creates parameter version 1 approved by the base employee, with the given engine values. */
export function createParameterVersion(
  client: PrismaClient,
  base: BaseFixture,
  values: EngineParameterValues,
) {
  return client.parameterVersion.create({
    data: {
      number: 1,
      reason: 'Versión sintética',
      approvedByEmployeeNumber: base.employeeNumber,
      ...values,
    },
  });
}
