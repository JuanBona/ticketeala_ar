// Database access shared by every module: a Prisma client connected through the PostgreSQL adapter.
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Prisma 7 connects through a driver adapter: here, `pg` (node-postgres) with the .env URL.
    super({ adapter: new PrismaPg({ connectionString: readDatabaseUrl() }) });
  }

  /** Nest calls this when the app stops, so open connections are closed cleanly. */
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
