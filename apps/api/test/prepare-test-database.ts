// Vitest global setup: brings the test database up to date by applying pending migrations.
import 'dotenv/config';
import { execFileSync } from 'node:child_process';

export function setup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      'Falta TEST_DATABASE_URL en apps/api/.env (ver .env.example)',
    );
  }
  // Tests empty every table, so they must never point at the development database.
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      `TEST_DATABASE_URL no puede ser igual a DATABASE_URL: ${testDatabaseUrl}`,
    );
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
}
