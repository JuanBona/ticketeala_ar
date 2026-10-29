// Writes the audit log (D13, RNF11): who did what to which record, with the value before and after.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  employeeNumber: number;
  entity: string;
  entityId: string;
  action: string;
  previousValue: Prisma.InputJsonValue;
  newValue: Prisma.InputJsonValue;
}

/** A plain client or the transaction of the change being audited, so both commit together. */
export type AuditWriter = Pick<PrismaService, 'auditLog'>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** RNF11: inserts one row; the table only accepts inserts (immutability trigger). */
  async record(
    entry: AuditEntry,
    writer: AuditWriter = this.prisma,
  ): Promise<void> {
    await writer.auditLog.create({ data: entry });
  }
}
