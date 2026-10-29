// TOTP second factor (RN30, D35): new secrets, first enrollment and code checks that cannot be replayed.
import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { generateURI, ScureBase32Plugin, verify } from 'otplib';
import { AuditService } from '../auditoria/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TOTP_CLOCK_TOLERANCE_SECONDS,
  TOTP_ISSUER,
  TOTP_SECRET_BYTES,
} from './auth.constants.js';
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

  /** RN30, D35: the first code proves the app was set up; only then is the secret stored, encrypted and audited. */
  async confirmEnrollment(
    employeeNumber: number,
    secret: string,
    code: string,
  ): Promise<void> {
    const timeStep = await this.acceptedTimeStep(secret, code, null);
    await this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.employee.updateMany({
        where: { employeeNumber, totpSecret: null },
        data: {
          totpSecret: this.cipher.encrypt(this.base32.decode(secret)),
          totpLastTimeStep: timeStep,
        },
      });
      if (stored.count === 0) {
        throw new ConflictException(
          `Empleado ${employeeNumber} ya tiene el segundo factor activo`,
        );
      }
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

  private async acceptedTimeStep(
    secret: string,
    code: string,
    lastTimeStep: bigint | null,
  ): Promise<bigint> {
    const result = await verify({
      secret,
      token: code,
      epochTolerance: TOTP_CLOCK_TOLERANCE_SECONDS,
      afterTimeStep: lastTimeStep === null ? undefined : Number(lastTimeStep),
    });
    if (!result.valid || !('timeStep' in result)) {
      throw new UnauthorizedException(INVALID_CODE);
    }
    return BigInt(result.timeStep);
  }
}
