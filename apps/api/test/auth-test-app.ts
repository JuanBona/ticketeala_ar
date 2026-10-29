// Helpers for auth integration tests: the real app on the test database, synthetic employees and TOTP.
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import { generate, ScureBase32Plugin } from 'otplib';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { Roles } from '../src/auth/decorators.js';
import type { Role } from '../src/auth/role.js';
import { TOTP_SECRET_BYTES } from '../src/auth/auth.constants.js';
import { resetSecondFactor } from '../src/auth/second-factor-codes.js';
import { TotpSecretCipher } from '../src/auth/totp-secret-cipher.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const SYNTHETIC_PASSWORD = 'clave-sintetica-de-test';

/** Endpoints that exist only in tests, to exercise the global guards. */
@Controller('probe')
class ProbeController {
  @Get('any-employee')
  anyEmployee(): string {
    return 'ok';
  }

  @Roles('gerencia')
  @Get('management-only')
  managementOnly(): string {
    return 'ok';
  }
}

export async function createAuthTestApp(
  client: PrismaClient,
): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ProbeController],
  })
    .overrideProvider(PrismaService)
    .useValue(client)
    .compile();
  const app = testingModule.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export interface SyntheticEmployee {
  employeeNumber: number;
  email: string;
}

interface SyntheticEmployeeOptions {
  employeeNumber: number;
  roles: Role[];
}

/** Creates a synthetic active employee whose password is SYNTHETIC_PASSWORD, with the given roles. */
export async function createSyntheticEmployee(
  client: PrismaClient,
  options: SyntheticEmployeeOptions,
): Promise<SyntheticEmployee> {
  const category = await client.employeeCategory.upsert({
    where: { name: 'Sintética' },
    update: {},
    create: { name: 'Sintética' },
  });
  const area = await client.area.create({ data: { name: 'Área sintética' } });
  const email = `empleado.${options.employeeNumber}@example.com`;
  await client.employee.create({
    data: {
      employeeNumber: options.employeeNumber,
      fullName: `Empleado ${options.employeeNumber} (sintético)`,
      email,
      categoryId: category.id,
      areaId: area.id,
      passwordHash: await argon2.hash(SYNTHETIC_PASSWORD),
      roles: { create: options.roles.map((name) => roleGrant(name)) },
    },
  });
  return { employeeNumber: options.employeeNumber, email };
}

function roleGrant(name: Role) {
  return {
    role: { connectOrCreate: { where: { name }, create: { name } } },
  };
}

/** RN30: stores an encrypted TOTP secret for the employee, as a finished enrollment would, and returns it. */
export async function enrollSecondFactor(
  client: PrismaClient,
  employeeNumber: number,
): Promise<string> {
  const secretBytes = randomBytes(TOTP_SECRET_BYTES);
  await client.employee.update({
    where: { employeeNumber },
    data: { totpSecret: new TotpSecretCipher().encrypt(secretBytes) },
  });
  return new ScureBase32Plugin().encode(secretBytes);
}

/** The code an authenticator app would show right now for this secret. */
export function currentCode(secret: string): Promise<string> {
  return generate({ secret });
}

/** Reads the base32 secret out of the otpauth:// link returned at enrollment. */
export function secretFromUri(otpauthUri: string): string {
  const secret = new URL(otpauthUri).searchParams.get('secret');
  if (!secret) {
    throw new Error(`Link de alta sin secret: ${otpauthUri}`);
  }
  return secret;
}

/** D36: what an administrator would hand over; issued directly, without going through the endpoint. */
export async function issueEnrollmentCode(
  client: PrismaClient,
  employeeNumber: number,
): Promise<string> {
  const issued = await client.$transaction((transaction) =>
    resetSecondFactor(transaction, {
      employeeNumber,
      issuedByEmployeeNumber: null,
    }),
  );
  return issued.enrollmentCode;
}
