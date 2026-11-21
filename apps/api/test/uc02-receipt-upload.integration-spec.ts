// UC-02 steps 1 to 3 (API side): upload a receipt photo, store it and create the pending expense (D25, D27, D31, 2a).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Role } from '../src/auth/role.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  ExpenseReportStatus,
  TravelRequestStatus,
} from '../src/generated/prisma/enums.js';
import { MAXIMUM_IMAGE_BYTES } from '../src/rendiciones/receipt-image-rules.js';
import { ReceiptImageStore } from '../src/rendiciones/receipt-image-store.js';
import {
  createAuthTestApp,
  createSyntheticEmployee,
  SYNTHETIC_PASSWORD,
} from './auth-test-app.js';
import { createTestClient, truncateAllTables } from './test-database.js';

const OWNER_NUMBER = 3001;
const OTHER_EMPLOYEE_NUMBER = 3002;
const ADVISOR_NUMBER = 3003;
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF_BYTES = Buffer.from('%PDF-1.7 documento sintético');

/** Stands in for SeaweedFS: keeps the photos in memory so tests need no storage service. */
class InMemoryImageStore {
  readonly saved = new Map<string, { body: Buffer; contentType: string }>();

  async save(key: string, body: Buffer, contentType: string): Promise<void> {
    this.saved.set(key, { body, contentType });
  }
}

describe('UC-02 receipt upload', () => {
  let client: PrismaClient;
  let app: INestApplication;
  let imageStore: InMemoryImageStore;
  let ownerToken: string;
  let travelRequestId: number;

  beforeAll(() => {
    client = createTestClient();
  });

  beforeEach(async () => {
    await truncateAllTables(client);
    imageStore = new InMemoryImageStore();
    app = await createAuthTestApp(client, [
      { provide: ReceiptImageStore, useValue: imageStore },
    ]);
    ownerToken = await loginAs(OWNER_NUMBER, ['empleado']);
    travelRequestId = await createTravelRequest(TravelRequestStatus.APPROVED);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function loginAs(
    employeeNumber: number,
    roles: Role[],
  ): Promise<string> {
    const employee = await createSyntheticEmployee(client, {
      employeeNumber,
      roles,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employee.email, password: SYNTHETIC_PASSWORD });
    return login.body.accessToken;
  }

  /** A synthetic request of the owner, written directly: UC-01 has its own tests. */
  async function createTravelRequest(
    status: TravelRequestStatus,
  ): Promise<number> {
    const owner = await client.employee.findUniqueOrThrow({
      where: { employeeNumber: OWNER_NUMBER },
    });
    const destination = await client.destination.create({
      data: { city: 'Córdoba', country: 'Argentina' },
    });
    const policy = await client.expensePolicy.create({
      data: {
        categoryId: owner.categoryId,
        destinationId: destination.id,
        amountCap: '250000.00',
        version: 1,
        authorEmployeeNumber: OWNER_NUMBER,
      },
    });
    const created = await client.travelRequest.create({
      data: {
        employeeNumber: OWNER_NUMBER,
        destinationId: destination.id,
        policyId: policy.id,
        status,
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-12'),
      },
    });
    return created.id;
  }

  /** POST /expenses with the photo and the declared fields; overrides change one field per test. */
  function upload(
    fields: Record<string, string> = {},
    options: { token?: string; image?: Buffer | null } = {},
  ) {
    const token = options.token ?? ownerToken;
    const image = options.image === undefined ? JPEG_BYTES : options.image;
    const call = request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`);
    const declared = {
      travelRequestId: String(travelRequestId),
      expenseType: 'comida',
      ...fields,
    };
    for (const [name, value] of Object.entries(declared)) {
      call.field(name, value);
    }
    if (image) {
      call.attach('image', image, {
        filename: 'comprobante.jpg',
        contentType: 'image/jpeg',
      });
    }
    return call;
  }

  it('UC-02 step 3: stores the photo and creates a pending expense with zero attempts (D25)', async () => {
    const response = await upload();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      verificationStatus: 'pendiente',
      imageAttempts: 0,
    });
    const expense = await client.expense.findUniqueOrThrow({
      where: { id: response.body.expenseId },
    });
    expect(expense.verificationStatus).toBe('PENDING');
    expect(expense.imageAttempts).toBe(0);
    expect(expense.category).toBe('MEALS');
    expect(expense.currency).toBe('ARS');
    expect(imageStore.saved.get(expense.receiptUrl!)?.body).toEqual(JPEG_BYTES);
    expect(imageStore.saved.get(expense.receiptUrl!)?.contentType).toBe(
      'image/jpeg',
    );
  });

  it('UC-02 step 1: opens the report as borrador the first time and reuses it afterwards', async () => {
    const first = await upload();
    const second = await upload();

    expect(second.body.expenseReportId).toBe(first.body.expenseReportId);
    const reports = await client.expenseReport.findMany();
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe(ExpenseReportStatus.DRAFT);
  });

  it('D31: keeps the currency the employee declared', async () => {
    const response = await upload({ currency: 'USD' });

    const expense = await client.expense.findUniqueOrThrow({
      where: { id: response.body.expenseId },
    });
    expect(expense.currency).toBe('USD');
  });

  it('UC-02 step 2: keeps the location and capture date when the employee sent them', async () => {
    const response = await upload({
      latitude: '-31.4201',
      longitude: '-64.1888',
      capturedAt: '2026-11-11T15:30:00-03:00',
    });

    const expense = await client.expense.findUniqueOrThrow({
      where: { id: response.body.expenseId },
    });
    expect(Number(expense.latitude)).toBeCloseTo(-31.4201);
    expect(Number(expense.longitude)).toBeCloseTo(-64.1888);
    expect(expense.capturedAt?.toISOString()).toBe('2026-11-11T18:30:00.000Z');
  });

  it('UC-02 2a: stores no location when the employee did not allow it', async () => {
    const response = await upload();

    const expense = await client.expense.findUniqueOrThrow({
      where: { id: response.body.expenseId },
    });
    expect(expense.latitude).toBeNull();
    expect(expense.longitude).toBeNull();
  });

  it('rejects a location with only one coordinate', async () => {
    const response = await upload({ latitude: '-31.4201' });

    expect(response.status).toBe(400);
    expect(imageStore.saved.size).toBe(0);
  });

  it('D27: rejects an expense type outside the catalog', async () => {
    const response = await upload({ expenseType: 'viaticos' });

    expect(response.status).toBe(400);
  });

  it('rejects a currency that is not an ISO 4217 code', async () => {
    const response = await upload({ currency: 'pesos' });

    expect(response.status).toBe(400);
  });

  it('answers 400 when the photo is missing', async () => {
    const response = await upload({}, { image: null });

    expect(response.status).toBe(400);
    expect(await client.expense.count()).toBe(0);
  });

  it('answers 415 and stores nothing when the file is not a JPEG or PNG', async () => {
    const response = await upload({}, { image: PDF_BYTES });

    expect(response.status).toBe(415);
    expect(imageStore.saved.size).toBe(0);
    expect(await client.expense.count()).toBe(0);
  });

  it('answers 413 when the photo is larger than the limit', async () => {
    const tooLarge = Buffer.alloc(MAXIMUM_IMAGE_BYTES + 1, 0xff);

    const response = await upload({}, { image: tooLarge });

    expect(response.status).toBe(413);
    expect(imageStore.saved.size).toBe(0);
  });

  it('UC-02 precondition: rejects a request that is not approved', async () => {
    travelRequestId = await createTravelRequest(TravelRequestStatus.PENDING);

    const response = await upload();

    expect(response.status).toBe(422);
    expect(imageStore.saved.size).toBe(0);
  });

  it('never trusts the client: another employee cannot load receipts on the request', async () => {
    const otherToken = await loginAs(OTHER_EMPLOYEE_NUMBER, ['empleado']);

    const response = await upload({}, { token: otherToken });

    expect(response.status).toBe(403);
    expect(imageStore.saved.size).toBe(0);
  });

  it('answers 404 for a request that does not exist', async () => {
    const response = await upload({ travelRequestId: '99999' });

    expect(response.status).toBe(404);
  });

  it('UC-02 precondition: a presented or approved report no longer takes receipts', async () => {
    await upload();
    await client.expenseReport.updateMany({
      data: { status: ExpenseReportStatus.SUBMITTED },
    });

    const response = await upload();

    expect(response.status).toBe(409);
    expect(await client.expense.count()).toBe(1);
  });

  it('UC-02 precondition: an observed report takes receipts again', async () => {
    await upload();
    await client.expenseReport.updateMany({
      data: { status: ExpenseReportStatus.OBSERVED },
    });

    const response = await upload();

    expect(response.status).toBe(201);
  });

  it('only the employee role can upload: the agency advisor gets 403', async () => {
    const advisorToken = await loginAs(ADVISOR_NUMBER, ['agencia']);

    const response = await upload({}, { token: advisorToken });

    expect(response.status).toBe(403);
  });

  it('asks for a token: without one the answer is 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/expenses')
      .field('travelRequestId', String(travelRequestId))
      .field('expenseType', 'comida')
      .attach('image', JPEG_BYTES, 'comprobante.jpg');

    expect(response.status).toBe(401);
  });
});
