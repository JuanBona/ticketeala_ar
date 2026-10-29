// Runs every synthetic seed in one transaction, so a failure leaves the database as it was.
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedEngineParameters } from './engine-parameters.js';
import { seedOrganization } from './organization.js';
import { seedTravelPolicies } from './travel-policies.js';

/** About a hundred sequential queries can exceed Prisma's 5 s default on a slow machine. */
const SEED_TRANSACTION_TIMEOUT_MILLISECONDS = 60_000;

/** Seeds organization, travel policies and engine parameters; running it again inserts nothing new. */
export async function seedDatabase(
  client: PrismaClient,
  passwordHash: string,
): Promise<void> {
  await client.$transaction(
    async (transaction) => {
      // Order matters: policies need categories, and parameters need an approver employee.
      await seedOrganization(transaction, passwordHash);
      await seedTravelPolicies(transaction);
      await seedEngineParameters(transaction);
    },
    { timeout: SEED_TRANSACTION_TIMEOUT_MILLISECONDS },
  );
}
