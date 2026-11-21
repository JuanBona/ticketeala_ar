// UC-02 step 4: the real publisher writes the job in the Redis stream `verify.requests`, in the field `pedido` (D23).
import 'dotenv/config';
import { Redis } from 'ioredis';
import {
  REQUEST_FIELD,
  readRedisSettings,
  VERIFY_REQUESTS_STREAM,
  VerifyQueue,
} from '../src/rendiciones/verify-queue.js';
import type { VerifyRequest } from '../src/rendiciones/verify-request-rules.js';

const SYNTHETIC_JOB = { job_id: 'synthetic', gasto_id: 1 } as VerifyRequest;

describe('VerifyQueue with the real Redis', () => {
  let reader: Redis;
  let publishedId: string | null = null;

  beforeAll(() => {
    reader = new Redis(readRedisSettings(process.env));
  });

  afterEach(async () => {
    // Only the entry this test added is removed: the stream may hold real jobs of the developer.
    if (publishedId) {
      await reader.xdel(VERIFY_REQUESTS_STREAM, publishedId);
    }
  });

  afterAll(async () => {
    await reader.quit();
  });

  it('adds the job as JSON in the pedido field', async () => {
    publishedId = await new VerifyQueue().publish(SYNTHETIC_JOB);

    const entries = await reader.xrange(
      VERIFY_REQUESTS_STREAM,
      publishedId!,
      publishedId!,
    );
    const fields = entries[0][1];
    expect(fields[0]).toBe(REQUEST_FIELD);
    expect(JSON.parse(fields[1])).toEqual(SYNTHETIC_JOB);
  });
});
