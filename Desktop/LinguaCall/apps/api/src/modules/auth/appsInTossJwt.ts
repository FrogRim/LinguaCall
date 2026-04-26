import jwt from 'jsonwebtoken';

const TTL_SECONDS = 60 * 60 * 24; // 24h

function getSecret(): string {
  const secret = process.env.APPS_IN_TOSS_JWT_SECRET;
  if (!secret) throw new Error('APPS_IN_TOSS_JWT_SECRET is not set');
  return secret;
}

export interface AppsInTossJwtPayload {
  userId: string;
  clerkUserId: string;
}

export function signAppsInTossJwt(payload: AppsInTossJwtPayload): string {
  return jwt.sign(payload, getSecret(), {
    algorithm: 'HS256',
    expiresIn: TTL_SECONDS,
  });
}

export function verifyAppsInTossJwt(token: string): AppsInTossJwtPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof (decoded as Record<string, unknown>).userId === 'string' &&
      typeof (decoded as Record<string, unknown>).clerkUserId === 'string'
    ) {
      return decoded as AppsInTossJwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}
