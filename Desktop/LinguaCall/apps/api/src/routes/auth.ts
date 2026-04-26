import { Router } from 'express';
import { z } from 'zod';
import { store } from '../storage/inMemoryStore';
import { signAppsInTossJwt } from '../modules/auth/appsInTossJwt';

const router = Router();

const APPS_IN_TOSS_OAUTH_BASE_URL =
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2';

const loginSchema = z.object({
  authorizationCode: z.string().min(1),
  referrer: z.string().min(1),
});

type AppsInTossGenerateTokenResponse = { accessToken?: string; access_token?: string };
type AppsInTossLoginMeResponse = { userKey?: string; user_key?: string };

const readPartnerApiKey = (): string | undefined =>
  process.env.APPS_IN_TOSS_PARTNER_API_KEY?.trim() ||
  process.env.APPS_IN_TOSS_API_KEY?.trim() ||
  undefined;

async function fetchAccessToken(authorizationCode: string, referrer: string): Promise<string> {
  const partnerApiKey = readPartnerApiKey();
  const res = await fetch(`${APPS_IN_TOSS_OAUTH_BASE_URL}/generate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(partnerApiKey ? { Authorization: `Bearer ${partnerApiKey}` } : {}),
    },
    body: JSON.stringify({ authorizationCode, referrer }),
  });
  if (!res.ok) throw new Error('apps_in_toss_oauth_failed');
  const body = (await res.json()) as AppsInTossGenerateTokenResponse;
  const token = body.accessToken ?? body.access_token;
  if (typeof token !== 'string' || !token.trim()) throw new Error('apps_in_toss_oauth_failed');
  return token;
}

async function fetchUserKey(accessToken: string): Promise<string> {
  const res = await fetch(`${APPS_IN_TOSS_OAUTH_BASE_URL}/login-me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('apps_in_toss_oauth_failed');
  const body = (await res.json()) as AppsInTossLoginMeResponse;
  const userKey = body.userKey ?? body.user_key;
  if (typeof userKey !== 'string' || !userKey.trim()) throw new Error('apps_in_toss_oauth_failed');
  return userKey;
}

router.post('/apps-in-toss/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: 'invalid_input', message: 'authorizationCode and referrer are required' } });
    return;
  }

  const { authorizationCode, referrer } = parsed.data;

  let userKey: string;
  try {
    const accessToken = await fetchAccessToken(authorizationCode, referrer);
    userKey = await fetchUserKey(accessToken);
  } catch {
    res.status(401).json({ ok: false, error: { code: 'oauth_failed', message: 'AppInToss authentication failed' } });
    return;
  }

  const clerkUserId = `apps_in_toss:${userKey}`;
  const pool = store.getPool();

  // Find existing user by apps_in_toss_user_key
  const existing = await pool.query<{ id: string; clerk_user_id: string }>(
    'SELECT id, clerk_user_id FROM users WHERE apps_in_toss_user_key = $1 LIMIT 1',
    [userKey]
  );

  let userId: string;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
  } else {
    // Create new user
    const created = await pool.query<{ id: string }>(
      `INSERT INTO users (clerk_user_id, apps_in_toss_user_key, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (clerk_user_id) DO UPDATE
         SET apps_in_toss_user_key = EXCLUDED.apps_in_toss_user_key,
             updated_at = NOW()
       RETURNING id`,
      [clerkUserId, userKey]
    );
    userId = created.rows[0].id;
  }

  const token = signAppsInTossJwt({ userId, clerkUserId });
  res.json({ ok: true, data: { token } });
});

export default router;
