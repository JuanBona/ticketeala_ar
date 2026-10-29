// Global interceptor (12.4, RNF11): after an @Audited endpoint succeeds, writes who changed what,
// with the value before and after, to registro_auditoria. Endpoints without @Audited pass untouched.
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, Observable, switchMap } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/authenticated-employee.js';
import { AuditService } from './audit.service.js';
import {
  AUDITED_KEY,
  isAuditedChange,
  type AuditedOperation,
} from './audited.decorator.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const operation = this.reflector.get<AuditedOperation | undefined>(
      AUDITED_KEY,
      context.getHandler(),
    );
    // Not @Audited: run the endpoint as is.
    if (!operation) {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // next.handle() runs the endpoint; switchMap waits for its result, records it, then answers.
    // If the endpoint throws, this never runs: failed operations are not audited.
    return next
      .handle()
      .pipe(
        switchMap((result: unknown) =>
          from(this.recordAndUnwrap(operation, request, result)),
        ),
      );
  }

  /** Writes the audit row and returns only the body meant for the client. */
  private async recordAndUnwrap(
    operation: AuditedOperation,
    request: AuthenticatedRequest,
    result: unknown,
  ): Promise<unknown> {
    // An @Audited endpoint that forgot auditedChange() is a programming error: fail loudly (500).
    if (!isAuditedChange(result)) {
      throw new Error(
        `Endpoint @Audited sin auditedChange(): ${request.method} ${request.url} (${operation.entity}/${operation.action})`,
      );
    }
    await this.audit.record({
      // Who: always from the signed token, never from the request body (12.4).
      employeeNumber: request.employee?.employeeNumber ?? null,
      entity: operation.entity,
      entityId: result.entityId,
      action: operation.action,
      previousValue: result.previousValue,
      newValue: result.newValue,
    });
    return result.response;
  }
}
