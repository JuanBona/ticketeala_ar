// UC-01 steps 1 to 6: creating a travel request and listing one's own requests.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  DestinationCatalog,
  type DestinationSummary,
} from '../administracion/destination-catalog.service.js';
import { EmployeeDirectory } from '../administracion/employee-directory.service.js';
import type {
  ExpensePolicy,
  Prisma,
  TravelRequest,
  TravelRequestStatus,
} from '../generated/prisma/client.js';
import { TravelRequestStatus as Status } from '../generated/prisma/enums.js';
import { ExpensePolicyService } from '../politicas/expense-policy.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TravelAllowanceService } from '../rendiciones/travel-allowance.service.js';
import type { CreateTravelRequestRequest } from './dto/create-travel-request.request.js';
import {
  daysBetween,
  estimateAllowance,
  missesMinimumAdvance,
  todayInArgentina,
} from './travel-request-rules.js';
import {
  toTravelRequestSummary,
  type TravelRequestSummary,
} from './travel-request-summary.js';

/** A request as the quotes module sees it (UC-01 steps 7 to 9). */
export interface QuotingContext {
  id: number;
  employeeNumber: number;
  status: TravelRequestStatus;
  currency: string;
  /** RN01: the cap of the policy the request was born with (RN02). */
  amountCap: Prisma.Decimal;
}

/** A request as the receipts module sees it (UC-02). */
export interface ReceiptContext {
  id: number;
  employeeNumber: number;
  status: TravelRequestStatus;
}

@Injectable()
export class TravelRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeeDirectory,
    private readonly destinations: DestinationCatalog,
    private readonly policies: ExpensePolicyService,
    private readonly allowances: TravelAllowanceService,
  ) {}

  /**
   * UC-01 steps 3 to 6: validates the data (3a), takes the policy in force for category + destination
   * as a snapshot (RN01, RN02), asks for a justification if the advance is short (4a), estimates the
   * allowance (D03, D11) and leaves the request "en_cotizacion" for AMR Turismo (D04, RN08).
   */
  async create(
    employeeNumber: number,
    request: CreateTravelRequestRequest,
  ): Promise<TravelRequestSummary> {
    const employee = await this.employees.findActive(employeeNumber);
    if (!employee) {
      throw new ForbiddenException(`Empleado ${employeeNumber} dado de baja`);
    }
    const today = todayInArgentina(new Date());
    assertValidDates(request, today);
    const destination = await this.requireDestination(request.destinationId);
    const origin = await this.findOrigin(request.originId);
    // RN01: category of the employee + destination pick the policy; RN02: the request keeps it forever.
    const policy = await this.policies.findInForce(
      employee.categoryId,
      destination.id,
    );
    if (!policy) {
      throw new UnprocessableEntityException(
        `No hay política vigente para la categoría ${employee.categoryId} y el destino ${destination.city} (RN01)`,
      );
    }
    const advanceJustification = requireAdvanceJustification(
      request,
      today,
      policy,
    );
    const nights = daysBetween(request.startDate, request.endDate);
    const estimatedAllowance = estimateAllowance(policy.dailyAllowance, nights);
    // The request and its allowance estimate are saved together: either both exist or neither does.
    const travelRequest = await this.prisma.$transaction(
      async (transaction) => {
        const created = await transaction.travelRequest.create({
          data: {
            employeeNumber,
            destinationId: destination.id,
            originId: origin?.id ?? null,
            policyId: policy.id,
            startDate: new Date(request.startDate),
            endDate: new Date(request.endDate),
            reason: request.reason,
            advanceJustification,
          },
        });
        await this.allowances.createEstimate(
          transaction,
          created.id,
          estimatedAllowance,
        );
        return created;
      },
    );
    return toTravelRequestSummary({
      travelRequest,
      destination,
      origin,
      policy,
      estimatedAllowance,
    });
  }

  /** Mobile-Viajes: the employee's own requests, newest first. Nobody sees someone else's here. */
  async listMine(employeeNumber: number): Promise<TravelRequestSummary[]> {
    const travelRequests = await this.prisma.travelRequest.findMany({
      where: { employeeNumber },
      orderBy: { requestedAt: 'desc' },
    });
    return this.summarize(travelRequests);
  }

  /** UC-03 steps 1 and 2: requests waiting for AMR Turismo's quotes, oldest first. */
  async listQuoting(): Promise<TravelRequestSummary[]> {
    const travelRequests = await this.prisma.travelRequest.findMany({
      where: { status: Status.QUOTING },
      orderBy: { requestedAt: 'asc' },
    });
    return this.summarize(travelRequests);
  }

  /** UC-01 step 12: requests waiting for this approver, oldest first (no notifications yet, D41). */
  async listPendingFor(
    approverEmployeeNumber: number,
  ): Promise<TravelRequestSummary[]> {
    const travelRequests = await this.prisma.travelRequest.findMany({
      where: { status: Status.PENDING, approverEmployeeNumber },
      orderBy: { requestedAt: 'asc' },
    });
    return this.summarize(travelRequests);
  }

  /** One request, as summary, after a change of status. */
  async summaryOf(id: number): Promise<TravelRequestSummary> {
    const travelRequest = await this.prisma.travelRequest.findUniqueOrThrow({
      where: { id },
    });
    const [summary] = await this.summarize([travelRequest]);
    return summary;
  }

  /** UC-02 precondition: whose request a receipt is loaded against and whether the trip was approved. */
  async findReceiptContext(id: number): Promise<ReceiptContext> {
    const travelRequest = await this.prisma.travelRequest.findUnique({
      where: { id },
    });
    if (!travelRequest) {
      throw new NotFoundException(`Solicitud ${id} inexistente`);
    }
    return {
      id: travelRequest.id,
      employeeNumber: travelRequest.employeeNumber,
      status: travelRequest.status,
    };
  }

  /** What the quotes module needs about a request: owner, status and the cap of its policy (RN02). */
  async findQuotingContext(id: number): Promise<QuotingContext> {
    const travelRequest = await this.prisma.travelRequest.findUnique({
      where: { id },
    });
    if (!travelRequest) {
      throw new NotFoundException(`Solicitud ${id} inexistente`);
    }
    const policies = await this.policies.findByIds([travelRequest.policyId]);
    const policy = requireFromMap(policies, travelRequest.policyId);
    return {
      id: travelRequest.id,
      employeeNumber: travelRequest.employeeNumber,
      status: travelRequest.status,
      currency: policy.currency,
      amountCap: policy.amountCap,
    };
  }

  /**
   * UC-01 9a: stores (or clears) the justification inside the transaction that selects the quote,
   * only while the request is still en_cotizacion. The UPDATE also locks the row until that
   * transaction ends, so a confirmation cannot slip in between (see lockWhileQuoting).
   * Returns false when the request already moved on.
   */
  async recordOverCapJustification(
    transaction: Prisma.TransactionClient,
    id: number,
    justification: string | null,
  ): Promise<boolean> {
    const updated = await transaction.travelRequest.updateMany({
      where: { id, status: Status.QUOTING },
      data: { overCapJustification: justification },
    });
    return updated.count === 1;
  }

  /**
   * Locks the request row for the rest of the transaction, if it is still en_cotizacion
   * (SELECT … FOR UPDATE). A selection running at the same time waits for it, so the
   * confirmation always sees the final choice. Returns false when it is no longer en_cotizacion.
   */
  async lockWhileQuoting(
    transaction: Prisma.TransactionClient,
    id: number,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<{ id: number }[]>`
      SELECT id FROM solicitud_viaje WHERE id = ${id} AND estado = 'en_cotizacion' FOR UPDATE`;
    return rows.length === 1;
  }

  /** Joins each request with its destination, policy and allowance, asking each owner module once. */
  private async summarize(
    travelRequests: TravelRequest[],
  ): Promise<TravelRequestSummary[]> {
    const destinations = new Map(
      (await this.destinations.list()).map((destination) => [
        destination.id,
        destination,
      ]),
    );
    const policies = await this.policies.findByIds(
      travelRequests.map((travelRequest) => travelRequest.policyId),
    );
    const allowances = await this.allowances.findEstimates(
      travelRequests.map((travelRequest) => travelRequest.id),
    );
    return travelRequests.map((travelRequest) =>
      toTravelRequestSummary({
        travelRequest,
        destination: requireFromMap(destinations, travelRequest.destinationId),
        origin: travelRequest.originId
          ? (destinations.get(travelRequest.originId) ?? null)
          : null,
        policy: requireFromMap(policies, travelRequest.policyId),
        estimatedAllowance: requireFromMap(allowances, travelRequest.id),
      }),
    );
  }

  private async requireDestination(id: number): Promise<DestinationSummary> {
    const destination = await this.destinations.find(id);
    if (!destination) {
      throw new BadRequestException(`Destino ${id} inexistente`);
    }
    return destination;
  }

  private async findOrigin(
    id: number | undefined,
  ): Promise<DestinationSummary | null> {
    if (id === undefined) {
      return null;
    }
    const origin = await this.destinations.find(id);
    if (!origin) {
      throw new BadRequestException(`Origen ${id} inexistente`);
    }
    return origin;
  }
}

/** UC-01 3a: a trip cannot start in the past nor end before it starts. */
function assertValidDates(
  request: CreateTravelRequestRequest,
  today: string,
): void {
  if (daysBetween(today, request.startDate) < 0) {
    throw new BadRequestException(
      `La fecha de inicio ${request.startDate} ya pasó (hoy es ${today})`,
    );
  }
  if (daysBetween(request.startDate, request.endDate) < 0) {
    throw new BadRequestException(
      `La fecha de fin ${request.endDate} es anterior a la de inicio ${request.startDate}`,
    );
  }
}

/**
 * UC-01 4a: with less advance than the policy asks, a justification is mandatory and the approver
 * will see it. With enough advance none is needed, so a text sent anyway is not stored.
 */
function requireAdvanceJustification(
  request: CreateTravelRequestRequest,
  today: string,
  policy: ExpensePolicy,
): string | null {
  if (
    !missesMinimumAdvance(today, request.startDate, policy.minimumAdvanceDays)
  ) {
    return null;
  }
  if (!request.advanceJustification) {
    // The code lets the app recognize this case and show the justification field (4a).
    throw new UnprocessableEntityException({
      code: 'ADVANCE_JUSTIFICATION_REQUIRED',
      message: `El viaje empieza en ${daysBetween(today, request.startDate)} días y la política pide ${policy.minimumAdvanceDays} de anticipación: agregá una justificación (UC-01 4a)`,
    });
  }
  return request.advanceJustification;
}

function requireFromMap<Key, Value>(map: Map<Key, Value>, key: Key): Value {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Dato relacionado faltante: ${String(key)}`);
  }
  return value;
}
