// Checks that the init migration applies and that the hand-written constraints reject invalid rows.
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  BaseFixture,
  createBaseFixture,
  createParameterVersion,
  createTestClient,
  createTravelRequest,
  INITIAL_ENGINE_PARAMETERS,
  truncateAllTables,
} from './test-database.js';

const DOMAIN_TABLE_COUNT = 22;
const MAXIMUM_SCORE = 100;
const ARCA_CODE_FACTURA_A = '1';

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
    supplierCuit: '30000000007',
    receiptType: ARCA_CODE_FACTURA_A,
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
    const parameterVersion = await createParameterVersion(
      client,
      base,
      INITIAL_ENGINE_PARAMETERS,
    );

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

describe('d24 engine parameter versions', () => {
  it('rn22 rejects an acceptance threshold equal to the alert threshold', async () => {
    const equalThresholds = createParameterVersion(client, base, {
      ...INITIAL_ENGINE_PARAMETERS,
      acceptanceThreshold: INITIAL_ENGINE_PARAMETERS.alertThreshold,
    });

    await expect(equalThresholds).rejects.toThrow(
      /version_parametros_rn22_check/,
    );
  });

  it('rejects an acceptance threshold above 100', async () => {
    const outOfRange = createParameterVersion(client, base, {
      ...INITIAL_ENGINE_PARAMETERS,
      acceptanceThreshold: MAXIMUM_SCORE + 1,
    });

    await expect(outOfRange).rejects.toThrow(
      /version_parametros_umbrales_rango_check/,
    );
  });

  it('rejects zero image attempts', async () => {
    const noAttempts = createParameterVersion(client, base, {
      ...INITIAL_ENGINE_PARAMETERS,
      maximumImageAttempts: 0,
    });

    await expect(noAttempts).rejects.toThrow(
      /version_parametros_intentos_check/,
    );
  });
});

describe('d31 receipt formats', () => {
  it('rejects a supplier CUIT written with dashes', async () => {
    const dashedCuit = client.supplier.create({
      data: { cuit: '30-00000000-7', legalName: 'Proveedor Sintético SA' },
    });

    await expect(dashedCuit).rejects.toThrow(/proveedor_cuit_formato_check/);
  });

  it('stores ARS when the expense currency is not declared', async () => {
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

    expect(expense.currency).toBe('ARS');
  });
});

describe('immutable policy versions', () => {
  it('rejects changing the amount cap of a policy version', async () => {
    const changedCap = client.expensePolicy.update({
      where: { id: base.policyId },
      data: { amountCap: '999999.00' },
    });

    await expect(changedCap).rejects.toThrow(/es inmutable/);
  });

  it('rejects reopening a closed policy version', async () => {
    await client.expensePolicy.update({
      where: { id: base.policyId },
      data: { validUntil: new Date('2026-10-27T12:00:00Z') },
    });

    const reopened = client.expensePolicy.update({
      where: { id: base.policyId },
      data: { validUntil: null },
    });

    await expect(reopened).rejects.toThrow(/es inmutable/);
  });

  it('rejects deleting a policy version', async () => {
    const deleted = client.expensePolicy.delete({
      where: { id: base.policyId },
    });

    await expect(deleted).rejects.toThrow(/es inmutable/);
  });
});

describe('immutable engine parameters', () => {
  it('rejects changing the thresholds of a parameter version', async () => {
    await createParameterVersion(client, base, INITIAL_ENGINE_PARAMETERS);

    const changedThresholds = client.parameterVersion.update({
      where: { number: 1 },
      data: { acceptanceThreshold: 90 },
    });

    await expect(changedThresholds).rejects.toThrow(/es inmutable/);
  });

  it('rejects changing the weight of a signal parameter', async () => {
    await createParameterVersion(client, base, INITIAL_ENGINE_PARAMETERS);
    const signal = await client.signalParameter.create({
      data: {
        version: 1,
        code: 'S04',
        description: 'Dígito verificador del CUIT',
        weight: 30,
        blocking: true,
        enabled: true,
      },
    });

    const changedWeight = client.signalParameter.update({
      where: { id: signal.id },
      data: { weight: 0 },
    });

    await expect(changedWeight).rejects.toThrow(/es inmutable/);
  });
});

describe('rnf11 audit log', () => {
  async function createAuditEntry() {
    return client.auditLog.create({
      data: {
        employeeNumber: base.employeeNumber,
        entity: 'politica_gasto',
        entityId: String(base.policyId),
        action: 'cierre',
      },
    });
  }

  it('rejects editing an audit entry', async () => {
    const entry = await createAuditEntry();

    const edited = client.auditLog.update({
      where: { id: entry.id },
      data: { action: 'otra' },
    });

    await expect(edited).rejects.toThrow(/es inmutable/);
  });

  it('rejects deleting an audit entry', async () => {
    const entry = await createAuditEntry();

    const deleted = client.auditLog.delete({ where: { id: entry.id } });

    await expect(deleted).rejects.toThrow(/es inmutable/);
  });
});

describe('rn28 records with history', () => {
  it('rejects deleting an employee who has a travel request', async () => {
    await createTravelRequest(client, base);

    const deleted = client.employee.delete({
      where: { employeeNumber: base.employeeNumber },
    });

    await expect(deleted).rejects.toThrow(/Foreign key constraint/);
  });
});

describe('d32 receipt type', () => {
  it('rejects a receipt type written as text instead of the ARCA code', async () => {
    const travelRequestId = await createTravelRequest(client, base);
    const expenseReport = await client.expenseReport.create({
      data: { travelRequestId },
    });

    const textType = client.expense.create({
      data: {
        expenseReportId: expenseReport.id,
        receiptType: 'FACTURA A',
        issuedOn: new Date('2026-11-11'),
        amount: '5000.00',
      },
    });

    await expect(textType).rejects.toThrow(
      /gasto_tipo_comprobante_codigo_arca_check/,
    );
  });
});

describe('d33 hierarchy', () => {
  it('rejects an employee as their own supervisor', async () => {
    const ownSupervisor = client.employee.update({
      where: { employeeNumber: base.employeeNumber },
      data: { supervisorEmployeeNumber: base.employeeNumber },
    });

    await expect(ownSupervisor).rejects.toThrow(/empleado_jefe_distinto_check/);
  });

  it('rejects an employee as their own substitute', async () => {
    const ownSubstitute = client.employee.update({
      where: { employeeNumber: base.employeeNumber },
      data: { substituteEmployeeNumber: base.employeeNumber },
    });

    await expect(ownSubstitute).rejects.toThrow(
      /empleado_suplente_distinto_check/,
    );
  });
});
