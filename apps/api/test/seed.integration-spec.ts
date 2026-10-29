// Checks the synthetic seed: idempotent, valid hierarchy, one policy in force per combination and the 12 signals.
import argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDatabase } from '../prisma/seed/seed-database.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const SEED_PASSWORD = 'clave-sintetica-de-test';
const D07_ROLES = [
  'empleado',
  'aprobador',
  'agencia',
  'contaduria',
  'gerencia',
  'administrador',
  'auditor',
];
const EXPENSE_TYPES_PER_POLICY = 4;
const CATEGORY_COUNT = 3;
const DESTINATION_COUNT = 4;

/** Signal table of docs/motor-verificacion.md with the column values of D24 and D29. */
const DOCUMENTED_SIGNALS = [
  {
    code: 'S01',
    weight: 0,
    blocking: false,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S02',
    weight: 10,
    blocking: false,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S03',
    weight: 25,
    blocking: false,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S04',
    weight: 30,
    blocking: true,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S05',
    weight: 15,
    blocking: false,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S06',
    weight: 15,
    blocking: false,
    threshold: 1,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S07',
    weight: 0,
    blocking: true,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S08',
    weight: 40,
    blocking: false,
    threshold: 10,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S09',
    weight: 25,
    blocking: false,
    threshold: 1,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S10',
    weight: 10,
    blocking: false,
    threshold: 300,
    warningThreshold: 50,
    factor: 1.2,
  },
  {
    code: 'S11',
    weight: 15,
    blocking: false,
    threshold: null,
    warningThreshold: null,
    factor: null,
  },
  {
    code: 'S12',
    weight: 10,
    blocking: false,
    threshold: 20,
    warningThreshold: null,
    factor: 1.5,
  },
];

let client: PrismaClient;
let passwordHash: string;

beforeAll(async () => {
  client = createTestClient();
  passwordHash = await argon2.hash(SEED_PASSWORD);
});

afterAll(async () => {
  await client.$disconnect();
});

beforeEach(async () => {
  await truncateAllTables(client);
  await seedDatabase(client, passwordHash);
});

async function countSeededRows(): Promise<number[]> {
  return Promise.all([
    client.role.count(),
    client.employeeCategory.count(),
    client.area.count(),
    client.employee.count(),
    client.employeeRole.count(),
    client.destination.count(),
    client.expensePolicy.count(),
    client.expenseCap.count(),
    client.parameterVersion.count(),
    client.signalParameter.count(),
  ]);
}

function toNumberOrNull(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString());
}

describe('seed idempotency', () => {
  it('inserts nothing new when it runs a second time', async () => {
    const countsAfterFirstRun = await countSeededRows();

    await seedDatabase(client, passwordHash);

    expect(await countSeededRows()).toEqual(countsAfterFirstRun);
  });

  it('keeps the existing password hash on the second run', async () => {
    const before = await client.employee.findMany({
      orderBy: { employeeNumber: 'asc' },
    });

    await seedDatabase(client, await argon2.hash('otra-clave'));

    const after = await client.employee.findMany({
      orderBy: { employeeNumber: 'asc' },
    });
    expect(after.map((employee) => employee.passwordHash)).toEqual(
      before.map((employee) => employee.passwordHash),
    );
  });
});

describe('d07 d15 d33 synthetic organization', () => {
  it('assigns every D07 role to at least one employee', async () => {
    const roles = await client.role.findMany({ include: { employees: true } });

    expect(roles.map((role) => role.name).sort()).toEqual(
      [...D07_ROLES].sort(),
    );
    expect(roles.every((role) => role.employees.length > 0)).toBe(true);
  });

  it('gives every employee a substitute and a supervisor other than themselves, except the top one', async () => {
    const employees = await client.employee.findMany();
    const withoutSupervisor = employees.filter(
      (employee) => employee.supervisorEmployeeNumber === null,
    );

    expect(employees).toHaveLength(10);
    expect(withoutSupervisor).toHaveLength(1);
    for (const employee of employees) {
      expect(employee.supervisorEmployeeNumber).not.toBe(
        employee.employeeNumber,
      );
      expect(employee.substituteEmployeeNumber).not.toBeNull();
      expect(employee.substituteEmployeeNumber).not.toBe(
        employee.employeeNumber,
      );
    }
  });

  it('reaches the top employee from everyone without cycles', async () => {
    const employees = await client.employee.findMany();
    const supervisorOf = new Map(
      employees.map((employee) => [
        employee.employeeNumber,
        employee.supervisorEmployeeNumber,
      ]),
    );

    for (const employee of employees) {
      const visited = new Set<number>();
      let current: number | null | undefined = employee.employeeNumber;
      while (
        current !== null &&
        current !== undefined &&
        !visited.has(current)
      ) {
        visited.add(current);
        current = supervisorOf.get(current);
      }
      expect(current).toBeNull();
    }
  });

  it('gives each area a manager from that area with the gerencia role', async () => {
    const areas = await client.area.findMany({
      include: { manager: { include: { roles: { include: { role: true } } } } },
    });

    expect(areas).toHaveLength(3);
    for (const area of areas) {
      expect(area.manager?.areaId).toBe(area.id);
      expect(
        area.manager?.roles.map((assignment) => assignment.role.name),
      ).toContain('gerencia');
    }
  });

  it('marks every employee as synthetic, without TOTP and with the SEED_PASSWORD hash', async () => {
    const employees = await client.employee.findMany();

    for (const employee of employees) {
      expect(employee.fullName).toContain('(sintético)');
      expect(employee.email).toMatch(/@example\.com$/);
      expect(employee.totpSecret).toBeNull();
      expect(await argon2.verify(employee.passwordHash, SEED_PASSWORD)).toBe(
        true,
      );
    }
  });
});

describe('d01 d26 seeded policies', () => {
  it('leaves exactly one policy in force per category and destination', async () => {
    const policiesInForce = await client.expensePolicy.groupBy({
      by: ['categoryId', 'destinationId'],
      where: { validUntil: null },
      _count: { _all: true },
    });

    expect(policiesInForce).toHaveLength(CATEGORY_COUNT * DESTINATION_COUNT);
    expect(policiesInForce.every((group) => group._count._all === 1)).toBe(
      true,
    );
  });

  it('gives every policy version 1 a cap for each expense type', async () => {
    const policies = await client.expensePolicy.findMany({
      include: { expenseCaps: true },
    });

    for (const policy of policies) {
      expect(policy.version).toBe(1);
      expect(policy.expenseCaps).toHaveLength(EXPENSE_TYPES_PER_POLICY);
    }
  });

  it('stores real coordinates for every destination (S10)', async () => {
    const destinations = await client.destination.findMany();

    expect(destinations).toHaveLength(DESTINATION_COUNT);
    expect(
      destinations.every((destination) => destination.latitude !== null),
    ).toBe(true);
    expect(
      destinations.every((destination) => destination.longitude !== null),
    ).toBe(true);
  });
});

describe('d24 d29 engine parameters', () => {
  it('creates version 1 with the initial thresholds and attempts', async () => {
    const version = await client.parameterVersion.findUniqueOrThrow({
      where: { number: 1 },
    });

    expect(version).toMatchObject({
      acceptanceThreshold: 80,
      alertThreshold: 50,
      maximumImageAttempts: 3,
      maximumQueueRetries: 3,
    });
  });

  it('stores the 12 signals exactly as docs/motor-verificacion.md and D29 define them', async () => {
    const signals = await client.signalParameter.findMany({
      where: { version: 1 },
      orderBy: { code: 'asc' },
    });

    const storedSignals = signals.map((signal) => ({
      code: signal.code,
      weight: signal.weight,
      blocking: signal.blocking,
      threshold: toNumberOrNull(signal.threshold),
      warningThreshold: toNumberOrNull(signal.warningThreshold),
      factor: toNumberOrNull(signal.factor),
    }));
    expect(storedSignals).toEqual(DOCUMENTED_SIGNALS);
    expect(signals.every((signal) => signal.enabled)).toBe(true);
  });
});
