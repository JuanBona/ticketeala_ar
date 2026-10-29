// Entry point of `npx prisma db seed`: loads synthetic data into the database in DATABASE_URL.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDatabase } from './seed/seed-database.js';

function readRequiredVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en apps/api/.env (ver .env.example)`);
  }
  return value;
}

async function main(): Promise<void> {
  // Hash once and reuse it: argon2 is slow on purpose, and every synthetic employee shares it.
  const passwordHash = await argon2.hash(readRequiredVariable('SEED_PASSWORD'));
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: readRequiredVariable('DATABASE_URL'),
    }),
  });
  try {
    await seedDatabase(client, passwordHash);
  } finally {
    // Close the connection even if the seed failed, so the command ends.
    await client.$disconnect();
  }
}

await main();
