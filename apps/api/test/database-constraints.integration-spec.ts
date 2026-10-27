// Checks that the init migration applies and that the hand-written constraints reject invalid rows.
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  BaseFixture,
  createBaseFixture,
  createTestClient,
  createTravelRequest,
  truncateAllTables,
} from './test-database.js';

const DOMAIN_TABLE_COUNT = 21;
const MAXIMUM_SCORE = 100;

let client: PrismaClient;
let base: BaseFixture;

beforeAll(() => {
  client = createTestClient();
});

afterAll(async () => {
  await client.$disconnect();
});

beforeEach(async () => {
  await truncateAllTables(client);
  base = await createBaseFixture(client);
});

describe('init migration', () => {
  it('creates every table of docs/modelo-datos.sql', async () => {
    const [{ count }] = await client.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

    expect(Number(count)).toBe(DOMAIN_TABLE_COUNT);
  });
});

describe('d01 policy versions', () => {
  it('rejects a second policy in force for the same category and destination', async () => {
    const secondVersion = client.expensePolicy.create({
      data: {
        categoryId: base.categoryId,
        destinationId: base.destinationId,
        amountCap: '150000.00',
        version: 2,
        authorEmployeeNumber: base.employeeNumber,
      },
    });

    await expect(secondVersion).rejects.toThrow(/Unique constraint/);
  });

  it('accepts a new version once the previous one is closed', async () => {
    await client.expensePolicy.update({
      where: { id: base.policyId },
      data: { validUntil: new Date('2026-10-27T12:00:00Z') },
    });

    const secondVersion = await client.expensePolicy.create({
      data: {
        categoryId: base.categoryId,
        destinationId: base.destinationId,
        amountCap: '150000.00',
        version: 2,
        authorEmployeeNumber: base.employeeNumber,
      },
    });

    expect(secondVersion.version).toBe(2);
  });
});

describe('quote selection', () => {
  it('rejects a second selected quote for the same travel request', async () => {
    const travelRequestId = await createTravelRequest(client, base);
    const selectedQuote = {
      travelRequestId,
      origin: 'AGENCY' as const,
      description: 'Pasaje sintético',
      amount: '50000.00',
      selected: true,
      loadedByEmployeeNumber: base.employeeNumber,
    };
    await client.quote.create({ data: selectedQuote });

    await expect(client.quote.create({ data: selectedQuote })).rejects.toThrow(
      /Unique constraint/,
    );
  });
});

describe('s07 duplicate fiscal key', () => {
  const fiscalKey = {
    supplierCuit: '30-00000000-7',
    receiptType: 'A',
    pointOfSale: 1,
    receiptNumber: 1234n,
  };

  async function createExpenseReport(): Promise<number> {
    const travelRequestId = await createTravelRequest(client, base);
    await client.supplier.create({
      data: {
        cuit: fiscalKey.supplierCuit,
        legalName: 'Proveedor Sintético SA',
      },
    });
    const expenseReport = await client.expenseReport.create({
      data: { travelRequestId },
    });
    return expenseReport.id;
  }

  function expenseWithFiscalKey(expenseReportId: number) {
    return {
      ...fiscalKey,
      expenseReportId,
      issuedOn: new Date('2026-11-11'),
      amount: '12100.00',
    };
  }

  it('rejects the same fiscal key on two active expenses', async () => {
    const expenseReportId = await createExpenseReport();
    await client.expense.create({
      data: expenseWithFiscalKey(expenseReportId),
    });

    const duplicate = client.expense.create({
      data: expenseWithFiscalKey(expenseReportId),
    });

    await expect(duplicate).rejects.toThrow(/Unique constraint/);
  });

  it('accepts the fiscal key again after the first expense is deactivated', async () => {
    const expenseReportId = await createExpenseReport();
    await client.expense.create({
      data: { ...expenseWithFiscalKey(expenseReportId), active: false },
    });

    const replacement = await client.expense.create({
      data: expenseWithFiscalKey(expenseReportId),
    });

    expect(replacement.active).toBe(true);
  });
});

describe('check constraints', () => {
  it('rejects a travel request that ends before it starts', async () => {
    const backwardsRequest = client.travelRequest.create({
      data: {
        employeeNumber: base.employeeNumber,
        destinationId: base.destinationId,
        policyId: base.policyId,
        startDate: new Date('2026-11-12'),
        endDate: new Date('2026-11-10'),
      },
    });

    await expect(backwardsRequest).rejects.toThrow(
      /solicitud_viaje_fechas_check/,
    );
  });

  it('rejects a verification score above 100', async () => {
    const travelRequestId = await createTravelRequest(client, base);
    const expenseReport = await client.expenseReport.create({
      data: { travelRequestId },
    });
    const expense = await client.expense.create({
      data: {
        expenseReportId: expenseReport.id,
        issuedOn: new Date('2026-11-11'),
        amount: '5000.00',
      },
    });
    const parameterVersion = await client.parameterVersion.create({
      data: {
        number: 1,
        reason: 'Versión sintética',
        approvedByEmployeeNumber: base.employeeNumber,
      },
    });

    const outOfRangeScore = client.receiptVerification.create({
      data: {
        expenseId: expense.id,
        parameterVersion: parameterVersion.number,
        imageQuality: '150.00',
        score: MAXIMUM_SCORE + 1,
        decision: 'ACCEPTED',
      },
    });

    await expect(outOfRangeScore).rejects.toThrow(
      /verificacion_comprobante_puntaje_check/,
    );
  });
});
