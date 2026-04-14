import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/client';

const SESSION_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const fallbackSessionTokenSecret = randomBytes(32).toString('hex');

export type SessionTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
};

class InvalidSessionTokenError extends Error {}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function getSessionTokenSecret() {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (isNonEmptyString(secret)) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_TOKEN_SECRET must be set in production');
  }

  return fallbackSessionTokenSecret;
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac('sha256', getSessionTokenSecret()).update(encodedPayload).digest();
}

function parseSessionTokenPayload(value: unknown): SessionTokenPayload {
  const record = asRecord(value);
  if (
    !record
    || !isNonEmptyString(record.sub)
    || typeof record.iat !== 'number'
    || !Number.isFinite(record.iat)
    || typeof record.exp !== 'number'
    || !Number.isFinite(record.exp)
  ) {
    throw new InvalidSessionTokenError('Invalid session token payload');
  }

  if (record.exp <= Math.floor(Date.now() / 1000)) {
    throw new InvalidSessionTokenError('Session token expired');
  }

  return {
    sub: record.sub,
    iat: record.iat,
    exp: record.exp,
  };
}

export function issueSessionToken(userId: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: userId,
    iat,
    exp: iat + SESSION_TOKEN_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signEncodedPayload(encodedPayload).toString('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload {
  const [encodedPayload, encodedSignature, ...rest] = token.split('.');
  if (!encodedPayload || !encodedSignature || rest.length > 0) {
    throw new InvalidSessionTokenError('Invalid session token format');
  }

  const receivedSignature = Buffer.from(encodedSignature, 'base64url');
  const expectedSignature = signEncodedPayload(encodedPayload);

  if (
    receivedSignature.length !== expectedSignature.length
    || !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new InvalidSessionTokenError('Invalid session token signature');
  }

  const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const payload: unknown = JSON.parse(payloadJson);
  return parseSessionTokenPayload(payload);
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const rawAuthorization = req.headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
  if (!authorization?.startsWith('Bearer ')) {
    await reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    await reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  let payload: SessionTokenPayload;
  try {
    payload = verifySessionToken(token);
  } catch (error) {
    if (!(error instanceof InvalidSessionTokenError)) {
      throw error;
    }

    await reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    await reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  return user;
}
