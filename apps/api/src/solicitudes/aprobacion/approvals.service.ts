// UC-01 steps 9 to 13, 9b and 12a: confirm a request, approve or reject it, or cancel it.
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EmployeeDirectory } from '../../administracion/employee-directory.service.js';
import {
  auditedChange,
  type AuditedChange,
} from '../../auditoria/audited.decorator.js';
import { exceedsCap } from '../../cotizaciones/quote-rules.js';
import { QuotesService } from '../../cotizaciones/quotes.service.js';
import type { TravelRequestStatus } from '../../generated/prisma/client.js';
import { TravelRequestStatus as Status } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { STATUS_NAMES } from '../travel-request-summary.js';
import {
  TravelRequestsService,
  type QuotingContext,
} from '../travel-requests.service.js';
import { ApproverResolver } from './approver-resolver.service.js';
import type { ApprovalView } from './dto/approval.responses.js';

export { ApprovalView } from './dto/approval.responses.js';

/** UC-01 9b: the employee may cancel between steps 6 and 12, i.e. before the approver decides. */
const CANCELLABLE: TravelRequestStatus[] = [Status.QUOTING, Status.PENDING];

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly travelRequests: TravelRequestsService,
    private readonly quotes: QuotesService,
    private readonly employees: EmployeeDirectory,
    private readonly approvers: ApproverResolver,
  ) {}

  /**
   * UC-01 steps 9 and 10: the requester confirms with a chosen quote (RN09); the request becomes
   * pendiente and gets its approver (D15, D41; one level up if over the cap, 9a; substitute, 10a).
   */
  async confirm(
    employeeNumber: number,
    travelRequestId: number,
  ): Promise<ApprovalView> {
    const context = await this.ownRequest(employeeNumber, travelRequestId);
    const requester = await this.employees.findActive(employeeNumber);
    if (!requester) {
      throw new ForbiddenException(`Empleado ${employeeNumber} dado de baja`);
    }
    await this.prisma.$transaction(async (transaction) => {
      // Lock the request first: a selection sent at the same time waits, so the approver below
      // is always chosen from the final quote (otherwise an over-cap quote could skip 9a).
      if (
        !(await this.travelRequests.lockWhileQuoting(
          transaction,
          travelRequestId,
        ))
      ) {
        throw await this.conflict(travelRequestId, Status.PENDING);
      }
      const selected = await this.quotes.findSelected(
        travelRequestId,
        transaction,
      );
      if (!selected) {
        throw new UnprocessableEntityException(
          `La solicitud ${travelRequestId} no tiene una cotización de la agencia elegida (RN09)`,
        );
      }
      const approverEmployeeNumber = await this.approvers.resolve(
        requester,
        exceedsCap(selected.amount, context.amountCap),
      );
      await transaction.travelRequest.update({
        where: { id: travelRequestId },
        data: { status: Status.PENDING, approverEmployeeNumber },
      });
    });
    return this.view(travelRequestId);
  }

  /** UC-01 step 12: the requests waiting for this approver, each with its chosen quote. */
  async listToApprove(approverEmployeeNumber: number): Promise<ApprovalView[]> {
    const pending = await this.travelRequests.listPendingFor(
      approverEmployeeNumber,
    );
    return Promise.all(pending.map((summary) => this.view(summary.id)));
  }

  /** UC-01 step 13: approved; RN03: from now on the allowance advance can be registered (UC-06). */
  async approve(
    approverEmployeeNumber: number,
    travelRequestId: number,
  ): Promise<AuditedChange<ApprovalView>> {
    const context = await this.assignedRequest(
      approverEmployeeNumber,
      travelRequestId,
    );
    await this.transition(context, {
      from: [Status.PENDING],
      data: { status: Status.APPROVED },
    });
    return this.audited(travelRequestId, { estado: 'aprobada' });
  }

  /** UC-01 12a: rejected with a reason the employee will read; the use case ends there. */
  async reject(
    approverEmployeeNumber: number,
    travelRequestId: number,
    reason: string,
  ): Promise<AuditedChange<ApprovalView>> {
    const context = await this.assignedRequest(
      approverEmployeeNumber,
      travelRequestId,
    );
    await this.transition(context, {
      from: [Status.PENDING],
      data: { status: Status.REJECTED, rejectionReason: reason },
    });
    return this.audited(travelRequestId, {
      estado: 'rechazada',
      motivoRechazo: reason,
    });
  }

  /** UC-01 9b: the requester cancels before the decision; quotes stay as history (RN28). */
  async cancel(
    employeeNumber: number,
    travelRequestId: number,
  ): Promise<ApprovalView> {
    const context = await this.ownRequest(employeeNumber, travelRequestId);
    await this.transition(context, {
      from: CANCELLABLE,
      data: { status: Status.CANCELLED },
    });
    return this.view(travelRequestId);
  }

  /**
   * Changes the status only if it is still one of `from`, in a single UPDATE: if the employee
   * cancels while the approver approves, exactly one of them wins and the other gets a 409.
   */
  private async transition(
    context: QuotingContext,
    change: StatusChange,
  ): Promise<void> {
    const updated = await this.prisma.travelRequest.updateMany({
      where: { id: context.id, status: { in: change.from } },
      data: change.data,
    });
    if (updated.count === 0) {
      throw await this.conflict(context.id, change.data.status);
    }
  }

  /** 409 that says where the request is now and where it could not go. */
  private async conflict(
    travelRequestId: number,
    target: TravelRequestStatus,
  ): Promise<ConflictException> {
    const current =
      await this.travelRequests.findQuotingContext(travelRequestId);
    return new ConflictException(
      `La solicitud ${travelRequestId} está ${STATUS_NAMES[current.status]}: no se puede pasar a ${STATUS_NAMES[target]}`,
    );
  }

  /** RNF11: approvals and rejections are audited with the status before and after. */
  private async audited(
    travelRequestId: number,
    newValue: { estado: string; motivoRechazo?: string },
  ): Promise<AuditedChange<ApprovalView>> {
    return auditedChange({
      entityId: String(travelRequestId),
      previousValue: { estado: STATUS_NAMES[Status.PENDING] },
      newValue,
      response: await this.view(travelRequestId),
    });
  }

  private async view(travelRequestId: number): Promise<ApprovalView> {
    const summary = await this.travelRequests.summaryOf(travelRequestId);
    const context =
      await this.travelRequests.findQuotingContext(travelRequestId);
    return {
      ...summary,
      selectedQuote: await this.quotes.selectedView(context),
    };
  }

  private async ownRequest(
    employeeNumber: number,
    travelRequestId: number,
  ): Promise<QuotingContext> {
    const context =
      await this.travelRequests.findQuotingContext(travelRequestId);
    if (context.employeeNumber !== employeeNumber) {
      throw new ForbiddenException(
        `La solicitud ${travelRequestId} es del empleado ${context.employeeNumber}, no del ${employeeNumber}`,
      );
    }
    return context;
  }

  /** Only the approver assigned at step 10 decides; holding the role is not enough. */
  private async assignedRequest(
    approverEmployeeNumber: number,
    travelRequestId: number,
  ): Promise<QuotingContext> {
    const context =
      await this.travelRequests.findQuotingContext(travelRequestId);
    const assigned = await this.travelRequests.summaryOf(travelRequestId);
    if (assigned.approverEmployeeNumber !== approverEmployeeNumber) {
      throw new ForbiddenException(
        `La solicitud ${travelRequestId} no está asignada al aprobador ${approverEmployeeNumber}`,
      );
    }
    return context;
  }
}

interface StatusChange {
  from: TravelRequestStatus[];
  data: {
    status: TravelRequestStatus;
    approverEmployeeNumber?: number;
    rejectionReason?: string;
  };
}
