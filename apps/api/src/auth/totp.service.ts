// TOTP second factor (RN30, D35, D36): new secrets, enrollment confirmed by the first code, and code checks.
import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { generateURI, ScureBase32Plugin, verify } from 'otplib';
import { AuditService } from '../auditoria/audit.service.js';
import { SecondFactorCodeType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TOTP_CLOCK_TOLERANCE_SECONDS,
  TOTP_ISSUER,
  TOTP_SECRET_BYTES,
} from './auth.constants.js';
import {
  consumeSecondFactorCode,
  createRecoveryCodes,
} from './second-factor-codes.js';
import type { PendingEnrollment } from './second-factor-challenge.service.js';
import { TotpSecretCipher } from './totp-secret-cipher.js';

const INVALID_CODE = 'Código de segundo factor incorrecto, vencido o ya usado';

@Injectable()
export class TotpService {
  private readonly base32 = new ScureBase32Plugin();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TotpSecretCipher,
    private readonly audit: AuditService,
  ) {}

  /** RN30: a fresh random secret, in the base32 form authenticator apps read. */
  newSecret(): string {
    return this.base32.encode(randomBytes(TOTP_SECRET_BYTES));
  }

  /** The otpauth:// link the web or the app turns into the QR code to scan. */
  enrollmentUri(secret: string, email: string): string {
    return generateURI({ issuer: TOTP_ISSUER, label: email, secret });
  }

  /**
   * RN30, D36: the first code proves the app was set up. Then, all or nothing: the enrollment code
   * is spent, the secret is stored encrypted, recovery codes are created and the change is audited.
   * Returns the recovery codes, the only time they are shown.
   */
  async confirmEnrollment(
    employeeNumber: number,
    enrollment: PendingEnrollment,
    code: string,
  ): Promise<string[]> {
    // A wrong code throws here, before anything is written.
    const timeStep = await this.acceptedTimeStep(enrollment.secret, code, null);
    return this.prisma.$transaction(async (transaction) => {
      // The enrollment code works once: a second setup with the same code fails here.
      const enrollmentCodeSpent = await consumeSecondFactorCode(transaction, {
        id: BigInt(enrollment.enrollmentCodeId),
        employeeNumber,
        type: SecondFactorCodeType.ENROLLMENT,
      });
      if (!enrollmentCodeSpent) {
        throw new UnauthorizedException(
          `Código de habilitación vencido, anulado o ya usado para el empleado ${employeeNumber}`,
        );
      }
      // Store the secret only if none exists, so two parallel setups cannot overwrite each other.
      const stored = await transaction.employee.updateMany({
        where: { employeeNumber, totpSecret: null },
        data: {
          totpSecret: this.cipher.encrypt(
            this.base32.decode(enrollment.secret),
          ),
          totpLastTimeStep: timeStep,
        },
      });
      if (stored.count === 0) {
        throw new ConflictException(
          `Empleado ${employeeNumber} ya tiene el segundo factor activo`,
        );
      }
      const recoveryCodes = await createRecoveryCodes(
        transaction,
        employeeNumber,
      );
      await this.audit.record(
        {
          employeeNumber,
          entity: 'empleado',
          entityId: String(employeeNumber),
          action: 'activar_segundo_factor',
          previousValue: { segundoFactorActivo: false },
          newValue: { segundoFactorActivo: true },
        },
        transaction,
      );
      return recoveryCodes;
    });
  }

  /** RN30, D35: checks a code against the stored secret; each 30-second code works only once. */
  async verifyCode(employeeNumber: number, code: string): Promise<void> {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { employeeNumber },
      select: { totpSecret: true, totpLastTimeStep: true },
    });
    if (!employee.totpSecret) {
      throw new UnauthorizedException(
        `Empleado ${employeeNumber} sin segundo factor activo`,
      );
    }
    // The database holds the secret encrypted; decrypt it only in memory to check the code.
    const secret = this.base32.encode(this.cipher.decrypt(employee.totpSecret));
    const timeStep = await this.acceptedTimeStep(
      secret,
      code,
      employee.totpLastTimeStep,
    );
    await this.recordTimeStep(employeeNumber, timeStep);
  }

  /** Atomic, so two simultaneous requests with the same code cannot both pass. */
  private async recordTimeStep(
    employeeNumber: number,
    timeStep: bigint,
  ): Promise<void> {
    // Saves the new step only if it is later than the last one used; otherwise it is a replay.
    const recorded = await this.prisma.employee.updateMany({
      where: {
        employeeNumber,
        OR: [
          { totpLastTimeStep: null },
          { totpLastTimeStep: { lt: timeStep } },
        ],
      },
      data: { totpLastTimeStep: timeStep },
    });
    if (recorded.count === 0) {
      throw new UnauthorizedException(INVALID_CODE);
    }
  }

  /** Returns the 30-second step the code belongs to, or throws if the code is not valid now. */
  private async acceptedTimeStep(
    secret: string,
    code: string,
    lastTimeStep: bigint | null,
  ): Promise<bigint> {
    const result = await verify({
      secret,
      token: code,
      // Accept the previous and next step too, for phones whose clock is a little off.
      epochTolerance: TOTP_CLOCK_TOLERANCE_SECONDS,
      // Reject codes from steps already used (replay protection).
      afterTimeStep: lastTimeStep === null ? undefined : Number(lastTimeStep),
    });
    if (!result.valid || !('timeStep' in result)) {
      throw new UnauthorizedException(INVALID_CODE);
    }
    return BigInt(result.timeStep);
  }
}
