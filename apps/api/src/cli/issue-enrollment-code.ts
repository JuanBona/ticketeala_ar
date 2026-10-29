// Console command (D36): issues an enrollment code for the first administrator, whom nobody can serve from the app.
// Usage, from apps/api:  npm run auth:enrollment-code -- <legajo>
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { resetSecondFactor } from '../auth/second-factor-codes.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** The employee number comes as the first argument after `--`. */
function readEmployeeNumber(): number {
  const argument = process.argv[2];
  const employeeNumber = Number(argument);
  if (!Number.isInteger(employeeNumber)) {
    throw new Error(
      `Legajo inválido: "${argument ?? ''}". Uso: npm run auth:enrollment-code -- <legajo>`,
    );
  }
  return employeeNumber;
}

function readDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Falta DATABASE_URL en apps/api/.env (ver .env.example)');
  }
  return databaseUrl;
}

async function main(): Promise<void> {
  const employeeNumber = readEmployeeNumber();
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: readDatabaseUrl() }),
  });
  try {
    // Same logic as the admin endpoint; issuedBy is null because no person in the app issued it.
    const issued = await client.$transaction((transaction) =>
      resetSecondFactor(transaction, {
        employeeNumber,
        issuedByEmployeeNumber: null,
      }),
    );
    // Shown only here: the database keeps just its hash. Hand it over in person.
    console.log(
      `Código de habilitación para el legajo ${employeeNumber}: ${issued.enrollmentCode}`,
    );
    console.log(`Vence: ${issued.expiresAt.toISOString()}`);
  } finally {
    await client.$disconnect();
  }
}

await main();
