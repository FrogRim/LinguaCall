const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const STORAGE_KEY = 'linguacall.supabase.session';

type SupabaseUser = {
  id: string;
  phone?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type StoredSupabaseSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: SupabaseUser;
};

type SupabaseVerifyResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: SupabaseUser;
};

function ensureConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('supabase_auth_not_configured');
  }
}

function headers(accessToken?: string) {
  return {
    apikey: SUPABASE_ANON_KEY,
    'content-type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
}

async function request<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  ensureConfig();
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: headers(accessToken)
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof payload?.msg === 'string'
        ? payload.msg
        : typeof payload?.error_description === 'string'
          ? payload.error_description
          : typeof payload?.message === 'string'
            ? payload.message
            : 'supabase_auth_request_failed';
    throw new Error(message);
  }
  return payload as T;
}

function normalizeSession(payload: SupabaseVerifyResponse): StoredSupabaseSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt:
      payload.expires_at ??
      (payload.expires_in ? Math.floor(Date.now() / 1000) + payload.expires_in : undefined),
    user: payload.user
  };
}

export function readStoredSupabaseSession(): StoredSupabaseSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredSupabaseSession;
  } catch {
    return null;
  }
}

export function persistSupabaseSession(session: StoredSupabaseSession | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function startSupabasePhoneOtp(phone: string) {
  await request('/otp', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      create_user: true
    })
  });
}

export async function verifySupabasePhoneOtp(phone: string, token: string): Promise<StoredSupabaseSession> {
  const payload = await request<SupabaseVerifyResponse>('/verify', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      token,
      type: 'sms'
    })
  });
  return normalizeSession(payload);
}

export async function refreshSupabaseSession(refreshToken: string): Promise<StoredSupabaseSession> {
  const payload = await request<SupabaseVerifyResponse>('/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: refreshToken
    })
  });
  return normalizeSession(payload);
}

export async function signOutSupabase(accessToken: string) {
  try {
    await request('/logout', { method: 'POST' }, accessToken);
  } catch {
    // sign-out is best-effort; local session clearing is the important part
  }
}

