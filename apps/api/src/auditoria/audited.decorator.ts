// @Audited and AuditedChange (12.4, RNF11): how an endpoint asks AuditInterceptor to record its change.
import { SetMetadata } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

export const AUDITED_KEY = 'audit:audited';

/** What is being changed: the table (entity) and the verb (action), e.g. politica_gasto / cerrar_version. */
export interface AuditedOperation {
  entity: string;
  action: string;
}

/**
 * What an @Audited endpoint returns: the record id, its value before and after, and the body to answer.
 * The interceptor records the first three and sends only `response` to the client.
 */
export interface AuditedChange<Response> {
  readonly kind: 'audited-change';
  entityId: string;
  previousValue: Prisma.InputJsonValue;
  newValue: Prisma.InputJsonValue;
  response: Response;
}

/** Marks an endpoint whose successful calls must land in registro_auditoria (RNF11). */
export const Audited = (operation: AuditedOperation) =>
  SetMetadata(AUDITED_KEY, operation);

/** Builds the value an @Audited endpoint returns; the `kind` tag lets the interceptor recognize it. */
export function auditedChange<Response>(
  change: Omit<AuditedChange<Response>, 'kind'>,
): AuditedChange<Response> {
  return { kind: 'audited-change', ...change };
}

export function isAuditedChange(
  value: unknown,
): value is AuditedChange<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'audited-change'
  );
}
