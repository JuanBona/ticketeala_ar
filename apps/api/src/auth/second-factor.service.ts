// Step 2 of the login for RN30 roles (D35, D36): TOTP setup with an enrollment code, TOTP check,
// recovery codes, and enrollment codes issued by an administrator.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../auditoria/audit.service.js';
import { SecondFactorCodeType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ActiveEmployeeReader,
  type ActiveEmployee,
} from './active-employee.reader.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import {
  consumeSecondFactorCode,
  findValidEnrollmentCodeId,
  hashSecondFactorCode,
  resetSecondFactor,
  SecondFactorCodeError,
  type IssuedEnrollmentCode,
} from './second-factor-codes.js';
import {
  SecondFactorChallengeService,
  type SecondFactorChallenge,
} from './second-factor-challenge.service.js';
import { SessionIssuer, type TokenPair } from './session-issuer.service.js';
import { TotpService } from './totp.service.js';

export interface EnrollmentStart {
  /** New challenge that carries the pending setup; send it with the first code. */
  challengeToken: string;
  /** otpauth:// link for the QR. */
  otpauthUri: string;
}

/** At the end of a setup the answer also carries the recovery codes, shown only this once. */
export type SecondFactorResult = TokenPair & { recoveryCodes?: string[] };

@Injectable()
export class SecondFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: ActiveEmployeeReader,
    private readonly challenges: SecondFactorChallengeService,
    private readonly totp: TotpService,
    private readonly sessions: SessionIssuer,
    private readonly audit: AuditService,
  ) {}

  /** D36: setting up TOTP needs the enrollment code an administrator handed over in person. */
  async startEnrollment(
    challenge: SecondFactorChallenge,
    enrollmentCode: string,
  ): Promise<EnrollmentStart> {
    const employee = await this.activeEmployee(challenge.employeeNumber);
    if (employee.hasSecondFactor) {
      throw new ConflictException(
        `Empleado ${employee.employeeNumber} ya tiene el segundo factor activo`,
      );
    }
    // The code must be this employee's, unused, not voided and within its 24 hours.
    const enrollmentCodeId = await findValidEnrollmentCodeId(
      this.prisma,
      employee.employeeNumber,
      enrollmentCode,
    );
    if (enrollmentCodeId === null) {
      throw new UnauthorizedException(
        `Código de habilitación inválido, vencido o ya usado para el empleado ${employee.employeeNumber}`,
      );
    }
    // The secret travels inside the new challenge until the first code confirms it; nothing is stored yet.
    const secret = this.totp.newSecret();
    const challengeToken = await this.challenges.sign({
      employeeNumber: employee.employeeNumber,
      enrollment: { secret, enrollmentCodeId: String(enrollmentCodeId) },
    });
    return {
      challengeToken,
      otpauthUri: this.totp.enrollmentUri(secret, employee.email),
    };
  }

  /** RN30: checks the 6-digit code; during a setup the same code also confirms it (D36). */
  async verify(
    challenge: SecondFactorChallenge,
    code: string,
  ): Promise<SecondFactorResult> {
    const employee = await this.activeEmployee(challenge.employeeNumber);
    if (!challenge.enrollment) {
      await this.totp.verifyCode(employee.employeeNumber, code);
      return this.openSession(employee);
    }
    const recoveryCodes = await this.totp.confirmEnrollment(
      employee.employeeNumber,
      challenge.enrollment,
      code,
    );
    const tokens = await this.openSession(employee);
    return { ...tokens, recoveryCodes };
  }

  /** D36: a recovery code replaces the TOTP code once, e.g. when the phone was lost. */
  async recover(
    challenge: SecondFactorChallenge,
    recoveryCode: string,
  ): Promise<TokenPair> {
    const employee = await this.activeEmployee(challenge.employeeNumber);
    // Spend the code and audit it together: either both happen or neither does.
    await this.prisma.$transaction(async (transaction) => {
      const spent = await consumeSecondFactorCode(transaction, {
        employeeNumber: employee.employeeNumber,
        type: SecondFactorCodeType.RECOVERY,
        codeHash: hashSecondFactorCode(recoveryCode),
      });
      if (!spent) {
        throw new UnauthorizedException(
          `Código de recuperación inválido o ya usado para el empleado ${employee.employeeNumber}`,
        );
      }
      await this.audit.record(
        {
          employeeNumber: employee.employeeNumber,
          entity: 'empleado',
          entityId: String(employee.employeeNumber),
          action: 'usar_codigo_recuperacion',
          previousValue: {},
          newValue: { codigoRecuperacionUsado: true },
        },
        transaction,
      );
    });
    return this.openSession(employee);
  }

  /**
   * D36: an administrator resets an employee's second factor and gets a new enrollment code to hand
   * over in person. Nobody can do it for themselves: a second person must always be involved.
   */
  async issueEnrollmentCode(
    administrator: AuthenticatedEmployee,
    employeeNumber: number,
  ): Promise<IssuedEnrollmentCode> {
    if (administrator.employeeNumber === employeeNumber) {
      throw new ForbiddenException(
        `El administrador ${employeeNumber} no puede emitirse un código a sí mismo`,
      );
    }
    try {
      return await this.prisma.$transaction((transaction) =>
        resetSecondFactor(transaction, {
          employeeNumber,
          issuedByEmployeeNumber: administrator.employeeNumber,
        }),
      );
    } catch (error) {
      // Business errors (unknown employee, no RN30 role) become a 400; anything else stays a 500.
      if (error instanceof SecondFactorCodeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async activeEmployee(
    employeeNumber: number,
  ): Promise<ActiveEmployee> {
    const employee = await this.employees.find({ employeeNumber });
    if (!employee) {
      throw new UnauthorizedException(
        `Empleado ${employeeNumber} dado de baja`,
      );
    }
    return employee;
  }

  /** Every session opened here passed the second factor (RN30). */
  private openSession(employee: ActiveEmployee): Promise<TokenPair> {
    return this.sessions.open({
      employeeNumber: employee.employeeNumber,
      roles: employee.roles,
      secondFactorVerified: true,
    });
  }
}
