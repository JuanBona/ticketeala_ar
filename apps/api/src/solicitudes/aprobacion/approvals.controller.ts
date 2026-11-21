// HTTP endpoints of UC-01 steps 9 to 13: confirm, approver's tray, approve, reject and cancel.
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  Audited,
  type AuditedChange,
} from '../../auditoria/audited.decorator.js';
import type { AuthenticatedEmployee } from '../../auth/authenticated-employee.js';
import { CurrentEmployee, Roles } from '../../auth/decorators.js';
import { ApprovalsService, type ApprovalView } from './approvals.service.js';
import { RejectRequest } from './dto/reject.request.js';

@Controller('travel-requests')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Roles('empleado')
  @Post(':travelRequestId/confirmation')
  confirm(
    @CurrentEmployee() employee: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
  ): Promise<ApprovalView> {
    return this.approvals.confirm(employee.employeeNumber, travelRequestId);
  }

  // RN30: the 'aprobador' role always arrives with TOTP verified (global guard).
  @Roles('aprobador')
  @Get('to-approve')
  listToApprove(
    @CurrentEmployee() approver: AuthenticatedEmployee,
  ): Promise<ApprovalView[]> {
    return this.approvals.listToApprove(approver.employeeNumber);
  }

  // @Audited: the interceptor writes registro_auditoria with the status before and after (RNF11).
  @Roles('aprobador')
  @Audited({ entity: 'solicitud_viaje', action: 'aprobar' })
  @Post(':travelRequestId/approval')
  approve(
    @CurrentEmployee() approver: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
  ): Promise<AuditedChange<ApprovalView>> {
    return this.approvals.approve(approver.employeeNumber, travelRequestId);
  }

  @Roles('aprobador')
  @Audited({ entity: 'solicitud_viaje', action: 'rechazar' })
  @Post(':travelRequestId/rejection')
  reject(
    @CurrentEmployee() approver: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
    @Body() request: RejectRequest,
  ): Promise<AuditedChange<ApprovalView>> {
    return this.approvals.reject(
      approver.employeeNumber,
      travelRequestId,
      request.reason,
    );
  }

  @Roles('empleado')
  @Post(':travelRequestId/cancellation')
  cancel(
    @CurrentEmployee() employee: AuthenticatedEmployee,
    @Param('travelRequestId', ParseIntPipe) travelRequestId: number,
  ): Promise<ApprovalView> {
    return this.approvals.cancel(employee.employeeNumber, travelRequestId);
  }
}
