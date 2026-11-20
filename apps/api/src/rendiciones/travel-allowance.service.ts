// Travel allowances (D03): the viatico row of each request, starting with its estimated amount.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TravelAllowanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** D03: stores the estimate inside the transaction that creates the request, so both exist or neither. */
  async createEstimate(
    transaction: Prisma.TransactionClient,
    travelRequestId: number,
    estimatedAmount: Prisma.Decimal,
  ): Promise<void> {
    await transaction.travelAllowance.create({
      data: { travelRequestId, estimatedAmount },
    });
  }

  /** Estimated allowance of each request, by request id. */
  async findEstimates(
    travelRequestIds: number[],
  ): Promise<Map<number, Prisma.Decimal>> {
    const allowances = await this.prisma.travelAllowance.findMany({
      where: { travelRequestId: { in: travelRequestIds } },
    });
    return new Map(
      allowances.map((allowance) => [
        allowance.travelRequestId,
        allowance.estimatedAmount,
      ]),
    );
  }
}
