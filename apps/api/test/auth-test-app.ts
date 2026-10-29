// Helpers for auth integration tests: the real app on the test database plus synthetic employees.
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import { AppModule } from '../src/app.module.js';
import { Roles } from '../src/auth/decorators.js';
import type { Role } from '../src/auth/role.js';
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

  @Roles('contaduria')
  @Get('accounting-only')
  accountingOnly(): string {
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
