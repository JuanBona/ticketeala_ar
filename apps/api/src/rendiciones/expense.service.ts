// Expenses (gasto): UC-02 creates one per uploaded photo, pending verification (D25).
import { Injectable } from '@nestjs/common';
import type { Expense } from '../generated/prisma/client.js';
import type { ExpenseCategory } from '../generated/prisma/enums.js';
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
}
