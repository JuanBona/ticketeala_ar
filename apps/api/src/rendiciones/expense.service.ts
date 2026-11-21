// Expenses (gasto): UC-02 creates one per uploaded photo, pending verification (D25).
import { Injectable } from '@nestjs/common';
import type { Expense, Prisma } from '../generated/prisma/client.js';
import {
  VerificationDecision,
  type ExpenseCategory,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * `gasto.monto` is NOT NULL but the amount is read from the photo later (UC-02 step 6), so a
 * pending expense starts at zero. Anything not "verificado" must be ignored when adding up totals.
 */
const PROVISIONAL_AMOUNT = '0.00';

export interface NewPendingExpense {
  expenseReportId: number;
  category: ExpenseCategory;
  /** ISO 4217, declared by the employee (D31). */
  currency: string;
  /** Key of the photo in the image storage (D17). */
  imageKey: string;
  /** Provisional date (`gasto.fecha` is NOT NULL); the verification result replaces it. */
  provisionalDate: Date;
  /** UC-02 step 2: only present if the employee allowed it (Ley 25.326). */
  capture?: { latitude: number; longitude: number; capturedAt?: Date };
}

/** S08 looks back this many months for similar images of the same employee. */
const HASH_LOOKBACK_MONTHS = 12;

/** Where S12 looks for comparable accepted expenses: same destination, employee category and type. */
export interface AmountHistoryFilter {
  destinationId: number;
  employeeCategoryId: number;
  category: ExpenseCategory;
}

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  /** D25: the expense exists from the upload, with zero image attempts and "pendiente". */
  createPending(expense: NewPendingExpense): Promise<Expense> {
    return this.prisma.expense.create({
      data: {
        expenseReportId: expense.expenseReportId,
        category: expense.category,
        currency: expense.currency,
        receiptUrl: expense.imageKey,
        issuedOn: expense.provisionalDate,
        amount: PROVISIONAL_AMOUNT,
        latitude: expense.capture?.latitude,
        longitude: expense.capture?.longitude,
        capturedAt: expense.capture?.capturedAt,
        // verificationStatus and imageAttempts use the column defaults: pendiente and 0 (D25).
      },
    });
  }

  /** S08: active expenses of the employee in the last 12 months that already have an image hash. */
  findPreviousHashes(
    employeeNumber: number,
    excludedExpenseId: number,
  ): Promise<{ id: number; dhash: string | null }[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - HASH_LOOKBACK_MONTHS);
    return this.prisma.expense.findMany({
      where: {
        id: { not: excludedExpenseId },
        active: true,
        dhash: { not: null },
        issuedOn: { gte: since },
        expenseReport: { travelRequest: { employeeNumber } },
      },
      select: { id: true, dhash: true },
    });
  }

  /** S07, RN05, D28: active expenses of ANY employee with a complete fiscal key (D32: no ARCA code, no key). */
  findPreviousFiscalKeys(excludedExpenseId: number) {
    return this.prisma.expense.findMany({
      where: {
        id: { not: excludedExpenseId },
        active: true,
        supplierCuit: { not: null },
        receiptType: { not: null },
        pointOfSale: { not: null },
        receiptNumber: { not: null },
      },
      select: {
        id: true,
        supplierCuit: true,
        receiptType: true,
        pointOfSale: true,
        receiptNumber: true,
      },
    });
  }

  /** S12: amounts of accepted expenses of the same destination, employee category and expense type. */
  findAcceptedAmounts(
    filter: AmountHistoryFilter,
  ): Promise<{ amount: Prisma.Decimal; currency: string }[]> {
    return this.prisma.expense.findMany({
      where: {
        active: true,
        category: filter.category,
        verification: { decision: VerificationDecision.ACCEPTED },
        expenseReport: {
          travelRequest: {
            destinationId: filter.destinationId,
            policy: { categoryId: filter.employeeCategoryId },
          },
        },
      },
      select: { amount: true, currency: true },
    });
  }
}
