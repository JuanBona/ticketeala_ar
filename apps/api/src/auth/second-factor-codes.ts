// One-time codes of the second factor (D36): enrollment codes issued by an administrator and recovery codes.
// Plain functions over a Prisma transaction, so the admin endpoint and the console script share them.
import { createHash, randomBytes } from 'node:crypto';
import { ScureBase32Plugin } from 'otplib';
import type { Prisma } from '../generated/prisma/client.js';
import { SecondFactorCodeType } from '../generated/prisma/enums.js';
import {
  ENROLLMENT_CODE_LIFETIME_MILLISECONDS,
  RECOVERY_CODE_COUNT,
  SECOND_FACTOR_CODE_BYTES,
  SECOND_FACTOR_CODE_GROUP_LENGTH,
} from './auth.constants.js';
import { isRole, requiresSecondFactor } from './role.js';

type Transaction = Prisma.TransactionClient;

export interface EnrollmentCodeRequest {
  employeeNumber: number;
  /** Administrator who issues it; null when it comes from the console (the very first administrator). */
  issuedByEmployeeNumber: number | null;
}

export interface IssuedEnrollmentCode {
  enrollmentCode: string;
  expiresAt: Date;
}

/** Random code like `ABCD-EFGH-JKLM-NPQR`: 80 bits, so its SHA-256 hash cannot be reversed by brute force. */
export function generateSecondFactorCode(): string {
  // 10 random bytes become 16 base32 letters and digits, easy to read aloud or type.
  const letters = new ScureBase32Plugin().encode(
    randomBytes(SECOND_FACTOR_CODE_BYTES),
  );
  // Split into groups of 4 separated by dashes, like a product key.
  const groups = letters.match(
    new RegExp(`.{1,${SECOND_FACTOR_CODE_GROUP_LENGTH}}`, 'g'),
  );
  return (groups ?? []).join('-');
}

/** Only this hash is stored. Dashes, spaces and lowercase are ignored, so typing variations still match. */
export function hashSecondFactorCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * D36, RN30: lets an employee set up TOTP again, or for the first time. Removes the current secret,
 * voids every unused code, closes every session and issues a new enrollment code valid for 24 hours.
 */
export async function resetSecondFactor(
  transaction: Transaction,
  request: EnrollmentCodeRequest,
): Promise<IssuedEnrollmentCode> {
  const { employeeNumber } = request;
  await assertNeedsSecondFactor(transaction, employeeNumber);
  const now = new Date();
  // Forget the old phone: without a secret, the next login asks to set up TOTP again.
  const employee = await transaction.employee.update({
    where: { employeeNumber },
    data: { totpSecret: null, totpLastTimeStep: null },
  });
  // Older enrollment and recovery codes stop working: only the code issued now is valid.
  await transaction.secondFactorCode.updateMany({
    where: { employeeNumber, usedAt: null, voidedAt: null },
    data: { voidedAt: now },
  });
  // Whoever had the lost phone, or an open session, is logged out everywhere.
  await transaction.refreshSession.updateMany({
    where: { employeeNumber, revokedAt: null },
    data: { revokedAt: now },
  });
  const issued = await createEnrollmentCode(transaction, request);
  // RNF11: who reset whose second factor, before and after.
  await transaction.auditLog.create({
    data: {
      employeeNumber: request.issuedByEmployeeNumber,
      entity: 'empleado',
      entityId: String(employeeNumber),
      action: 'reiniciar_segundo_factor',
      previousValue: { segundoFactorActivo: employee.totpSecret !== null },
      newValue: { segundoFactorActivo: false, codigoHabilitacionEmitido: true },
    },
  });
  return issued;
}

/** D36: the enrollment code is valid only if unused, not voided, not expired and of this employee. */
export async function findValidEnrollmentCodeId(
  transaction: Transaction,
  employeeNumber: number,
  code: string,
): Promise<bigint | null> {
  const enrollmentCode = await transaction.secondFactorCode.findFirst({
    where: {
      employeeNumber,
      type: SecondFactorCodeType.ENROLLMENT,
      codeHash: hashSecondFactorCode(code),
      usedAt: null,
      voidedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return enrollmentCode?.id ?? null;
}

/**
 * Marks a code as used only if it is still usable, in a single UPDATE, so two simultaneous
 * requests with the same code cannot both succeed. Returns false when it was not usable.
 */
export async function consumeSecondFactorCode(
  transaction: Transaction,
  where: Prisma.SecondFactorCodeWhereInput,
): Promise<boolean> {
  const consumed = await transaction.secondFactorCode.updateMany({
    where: {
      ...where,
      usedAt: null,
      voidedAt: null,
      // Recovery codes have no expiry date; enrollment codes must still be in their 24 hours.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}

/** D36: the codes shown once at enrollment, each one replaces a TOTP code a single time. */
export async function createRecoveryCodes(
  transaction: Transaction,
  employeeNumber: number,
): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    generateSecondFactorCode(),
  );
  await transaction.secondFactorCode.createMany({
    data: codes.map((code) => ({
      employeeNumber,
      type: SecondFactorCodeType.RECOVERY,
      codeHash: hashSecondFactorCode(code),
    })),
  });
  return codes;
}

async function createEnrollmentCode(
  transaction: Transaction,
  request: EnrollmentCodeRequest,
): Promise<IssuedEnrollmentCode> {
  const enrollmentCode = generateSecondFactorCode();
  const expiresAt = new Date(
    Date.now() + ENROLLMENT_CODE_LIFETIME_MILLISECONDS,
  );
  await transaction.secondFactorCode.create({
    data: {
      employeeNumber: request.employeeNumber,
      type: SecondFactorCodeType.ENROLLMENT,
      codeHash: hashSecondFactorCode(enrollmentCode),
      expiresAt,
      issuedByEmployeeNumber: request.issuedByEmployeeNumber,
    },
  });
  return { enrollmentCode, expiresAt };
}

/** RN30: only active employees with approver, accounting or administrator roles use TOTP. */
async function assertNeedsSecondFactor(
  transaction: Transaction,
  employeeNumber: number,
): Promise<void> {
  const employee = await transaction.employee.findUnique({
    where: { employeeNumber },
    include: { roles: { include: { role: true } } },
  });
  if (!employee?.active) {
    throw new SecondFactorCodeError(
      `Empleado ${employeeNumber} inexistente o dado de baja`,
    );
  }
  const roles = employee.roles.map((grant) => grant.role.name).filter(isRole);
  if (!requiresSecondFactor(roles)) {
    throw new SecondFactorCodeError(
      `Empleado ${employeeNumber} no tiene roles que pidan segundo factor (RN30): ${roles.join(', ')}`,
    );
  }
}

/** A request that makes no sense for this employee; the HTTP layer turns it into a 400. */
export class SecondFactorCodeError extends Error {
  override name = 'SecondFactorCodeError';
}
