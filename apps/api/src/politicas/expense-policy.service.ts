// Expense policies (D01, RN01): finds the version in force for a category and destination.
import { Injectable } from '@nestjs/common';
import type { ExpenseCap, ExpensePolicy } from '../generated/prisma/client.js';
import type { ExpenseCategory } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ExpensePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * RN01: the policy depends on the employee's category and the destination. D01: only one version
   * is in force at a time, the one not closed yet (vigente_hasta empty); a partial unique index enforces it.
   */
  findInForce(
    categoryId: number,
    destinationId: number,
  ): Promise<ExpensePolicy | null> {
    return this.prisma.expensePolicy.findFirst({
      where: { categoryId, destinationId, validUntil: null },
    });
  }

  /** D26 (S11): the cap row of one expense type in a policy version; null if the policy sets none. */
  findCap(
    policyId: number,
    category: ExpenseCategory,
  ): Promise<ExpenseCap | null> {
    return this.prisma.expenseCap.findUnique({
      where: { policyId_category: { policyId, category } },
    });
  }

  /** The exact versions some requests point to (RN02), by id, whether still in force or closed. */
  async findByIds(ids: number[]): Promise<Map<number, ExpensePolicy>> {
    const policies = await this.prisma.expensePolicy.findMany({
      where: { id: { in: ids } },
    });
    return new Map(policies.map((policy) => [policy.id, policy]));
  }
}
