// Refresh tokens of D34: stored only as a hash, rotated on every use, whole family revoked on reuse.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RefreshSession } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_TOKEN_LIFETIME_MILLISECONDS } from './auth.constants.js';

const REFRESH_TOKEN_BYTES = 32;

export interface RotatedSession {
  employeeNumber: number;
  familyId: string;
  refreshToken: string;
}

type SessionWriter = Pick<PrismaService, 'refreshSession'>;

@Injectable()
export class RefreshSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Opens a new session family at login and returns its first refresh token (D34). */
  start(employeeNumber: number): Promise<string> {
    return this.issue(this.prisma, employeeNumber, randomUUID());
  }

  /** Swaps a valid refresh token for a new one; a reused token revokes its whole family (D34). */
  async rotate(refreshToken: string): Promise<RotatedSession> {
    const session = await this.findByToken(refreshToken);
    if (session.usedAt || session.revokedAt) {
      return this.rejectReuse(session);
    }
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        `Refresh token vencido el ${session.expiresAt.toISOString()}`,
      );
    }
    const nextToken = await this.claimAndReplace(session);
    if (!nextToken) {
      return this.rejectReuse(session);
    }
    return {
      employeeNumber: session.employeeNumber,
      familyId: session.familyId,
      refreshToken: nextToken,
    };
  }

  /** Logout: revokes the family of this token. Unknown tokens are ignored so logout never fails. */
  async revoke(refreshToken: string): Promise<void> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!session) {
      return;
    }
    await this.revokeFamily(session.familyId);
  }

  /** Revokes every open session of the family, e.g. when the employee was deactivated (RN28). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async findByToken(refreshToken: string): Promise<RefreshSession> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!session) {
      throw new UnauthorizedException('Refresh token desconocido');
    }
    return session;
  }

  /** Marks the token used and issues its successor atomically; null if another request won the race. */
  private claimAndReplace(session: RefreshSession): Promise<string | null> {
    return this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.refreshSession.updateMany({
        where: { id: session.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        return null;
      }
      return this.issue(transaction, session.employeeNumber, session.familyId);
    });
  }

  private async rejectReuse(session: RefreshSession): Promise<never> {
    await this.revokeFamily(session.familyId);
    throw new UnauthorizedException(
      `Refresh token ya usado: se cerró la sesión ${session.familyId}`,
    );
  }

  private async issue(
    writer: SessionWriter,
    employeeNumber: number,
    familyId: string,
  ): Promise<string> {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    await writer.refreshSession.create({
      data: {
        employeeNumber,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MILLISECONDS),
      },
    });
    return refreshToken;
  }
}

/** SHA-256 is enough here: the token is 32 random bytes, so unlike a password it cannot be guessed. */
function hashToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}
