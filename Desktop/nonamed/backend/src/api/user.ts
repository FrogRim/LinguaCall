import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { issueSessionToken } from './auth';

type AppLoginReferrer = 'DEFAULT' | 'SANDBOX';

type TokenExchangeResponse = {
  accessToken: string;
};

type LoginMeResponse = {
  userKey: string;
};

const APPS_IN_TOSS_API_BASE_URL = process.env.APPS_IN_TOSS_API_BASE_URL ?? 'https://apps-in-toss-api.toss.im';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAppLoginReferrer(value: unknown): value is AppLoginReferrer {
  return value === 'DEFAULT' || value === 'SANDBOX';
}

function isLoopbackHostname(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(value.toLowerCase());
}

function isLoopbackIp(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value.toLowerCase());
}

function getOriginHostname(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalDevBootstrapRequest(req: { ip: string; hostname: string; headers: { origin?: string | string[] } }): boolean {
  const rawOrigin = req.headers.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
  const originHostname = getOriginHostname(origin);

  return isLoopbackIp(req.ip)
    && isLoopbackHostname(req.hostname)
    && (originHostname === null || isLoopbackHostname(originHostname));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseTokenExchangeResponse(value: unknown): TokenExchangeResponse | null {
  const record = asRecord(value);
  if (!record || !isNonEmptyString(record.accessToken)) {
    return null;
  }

  return { accessToken: record.accessToken };
}

function parseLoginMeResponse(value: unknown): LoginMeResponse | null {
  const record = asRecord(value);
  if (!record || !isNonEmptyString(record.userKey)) {
    return null;
  }

  return { userKey: record.userKey };
}

async function exchangeAuthorizationCode(authorizationCode: string, referrer: AppLoginReferrer): Promise<string> {
  const tokenResponse = await fetch(
    `${APPS_IN_TOSS_API_BASE_URL}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authorizationCode, referrer }),
    },
  );

  if (!tokenResponse.ok) {
    throw new Error(`Apps in Toss token exchange failed with status ${tokenResponse.status}`);
  }

  const tokenPayload = parseTokenExchangeResponse(await tokenResponse.json());
  if (!tokenPayload) {
    throw new Error('Apps in Toss token exchange returned invalid payload');
  }

  const loginMeResponse = await fetch(
    `${APPS_IN_TOSS_API_BASE_URL}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenPayload.accessToken}`,
      },
    },
  );

  if (!loginMeResponse.ok) {
    throw new Error(`Apps in Toss login-me failed with status ${loginMeResponse.status}`);
  }

  const loginMePayload = parseLoginMeResponse(await loginMeResponse.json());
  if (!loginMePayload) {
    throw new Error('Apps in Toss login-me returned invalid payload');
  }

  return loginMePayload.userKey;
}

export async function userRoutes(app: FastifyInstance) {
  app.post<{ Body: { tossUserKey: string } }>('/users', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(403).send({ error: 'Local bootstrap is disabled in production' });
    }

    if (!isLocalDevBootstrapRequest(req)) {
      return reply.status(403).send({ error: 'Local bootstrap is only available from localhost' });
    }

    const { tossUserKey } = req.body;

    if (!tossUserKey || typeof tossUserKey !== 'string') {
      return reply.status(400).send({ error: 'tossUserKey is required' });
    }

    const user = await prisma.user.upsert({
      where: { tossUserKey },
      update: {},
      create: { tossUserKey },
    });

    return {
      sessionToken: issueSessionToken(user.id),
      plan: user.plan,
    };
  });

  app.post<{ Body: { authorizationCode: string; referrer: AppLoginReferrer } }>('/users/login', async (req, reply) => {
    const { authorizationCode, referrer } = req.body;

    if (!isNonEmptyString(authorizationCode)) {
      return reply.status(400).send({ error: 'authorizationCode is required' });
    }

    if (!isAppLoginReferrer(referrer)) {
      return reply.status(400).send({ error: 'referrer must be DEFAULT or SANDBOX' });
    }

    const tossUserKey = await exchangeAuthorizationCode(authorizationCode, referrer);
    const user = await prisma.user.upsert({
      where: { tossUserKey },
      update: {},
      create: { tossUserKey },
    });

    return {
      sessionToken: issueSessionToken(user.id),
      plan: user.plan,
    };
  });
}
