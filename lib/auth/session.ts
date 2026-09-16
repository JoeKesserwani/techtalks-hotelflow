import crypto from 'crypto';
import { prisma } from '../db';

const REFRESH_TOKEN_TTL_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

/** Validates a refresh token, rotates it, and returns the associated userId. */
export async function rotateSession(rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: tokenHash },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Delete the old session and issue a fresh one (rotation)
  await prisma.session.delete({ where: { id: session.id } });
  const next = await createSession(session.userId);

  return { userId: session.userId, ...next };
}

export async function revokeSession(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  await prisma.session.deleteMany({ where: { refreshTokenHash: tokenHash } });
}
