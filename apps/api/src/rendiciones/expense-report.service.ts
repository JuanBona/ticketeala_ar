// Expense report of a travel request (UC-02 precondition): finds it or opens it, only while it accepts receipts.
import { ConflictException, Injectable } from '@nestjs/common';
import type { ExpenseReport } from '../generated/prisma/client.js';
import { ExpenseReportStatus as Status } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Status names of the documents and screens. */
const STATUS_NAMES: Record<Status, string> = {
  [Status.DRAFT]: 'borrador',
  [Status.SUBMITTED]: 'presentada',
  [Status.APPROVED]: 'aprobada',
  [Status.OBSERVED]: 'observada',
};

/** UC-02 system precondition: the report is "borrador" or "observada". */
const STATUSES_ACCEPTING_RECEIPTS: Status[] = [Status.DRAFT, Status.OBSERVED];

@Injectable()
export class ExpenseReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC-02 step 1: the report of the request, opened as "borrador" the first time a receipt is
   * loaded. Nothing else creates it yet. Throws if it no longer accepts receipts.
   */
  async requireOpenReport(travelRequestId: number): Promise<ExpenseReport> {
    // upsert on the unique request id: two receipts uploaded at once still end up with one report.
    const report = await this.prisma.expenseReport.upsert({
      where: { travelRequestId },
      update: {},
      create: { travelRequestId },
    });
    if (!STATUSES_ACCEPTING_RECEIPTS.includes(report.status)) {
      throw new ConflictException(
        `La rendición ${report.id} está ${STATUS_NAMES[report.status]}: solo se cargan comprobantes en borrador u observada`,
      );
    }
    return report;
  }
}
