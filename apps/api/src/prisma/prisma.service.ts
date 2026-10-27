// Database access shared by every module: a Prisma client connected through the PostgreSQL adapter.
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: readDatabaseUrl() }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function readDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'Falta DATABASE_URL: copiá apps/api/.env.example a apps/api/.env',
    );
  }
  return databaseUrl;
}
