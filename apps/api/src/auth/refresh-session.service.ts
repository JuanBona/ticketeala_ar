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
  /** RN30 (D35): whether the login that opened this family passed TOTP. */
  secondFactorVerified: boolean;
  refreshToken: string;
}

export interface SessionOwner {
  employeeNumber: number;
  secondFactorVerified: boolean;
}

interface SessionFamily extends SessionOwner {
  familyId: string;
}

type SessionWriter = Pick<PrismaService, 'refreshSession'>;

@Injectable()
export class RefreshSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Opens a new session family at login and returns its first refresh token (D34, D35). */
  start(owner: SessionOwner): Promise<string> {
    return this.issue(this.prisma, { ...owner, familyId: randomUUID() });
  }

  /** Swaps a valid refresh token for a new one; a reused token revokes its whole family (D34). */
  async rotate(refreshToken: string): Promise<RotatedSession> {
    const session = await this.findByToken(refreshToken);
    // Already used or revoked: someone is replaying an old token, probably a stolen one.
    if (session.usedAt || session.revokedAt) {
      return this.rejectReuse(session);
    }
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        `Refresh token vencido el ${session.expiresAt.toISOString()}`,
      );
    }
    const nextToken = await this.claimAndReplace(session);
    // Another request used this same token a moment ago: treat it as reuse too.
    if (!nextToken) {
      return this.rejectReuse(session);
    }
    return {
      employeeNumber: session.employeeNumber,
      familyId: session.familyId,
      secondFactorVerified: session.secondFactor,
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
      // Mark it used only if nobody did it first; count tells whether we won.
      const claimed = await transaction.refreshSession.updateMany({
        where: { id: session.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        return null;
      }
      return this.issue(transaction, {
        employeeNumber: session.employeeNumber,
        familyId: session.familyId,
        secondFactorVerified: session.secondFactor,
      });
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
    family: SessionFamily,
  ): Promise<string> {
    // 32 random bytes as URL-safe text; the client keeps it, the database keeps only its hash.
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    await writer.refreshSession.create({
      data: {
        employeeNumber: family.employeeNumber,
        familyId: family.familyId,
        secondFactor: family.secondFactorVerified,
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
