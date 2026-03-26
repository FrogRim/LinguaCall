type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const SUPABASE_SUBJECT_PREFIX = 'supabase:';

export function toSupabaseSubject(userId: string) {
  return `${SUPABASE_SUBJECT_PREFIX}${userId}`;
}

export function resolveSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function getSupabaseDisplayName(user: SupabaseAuthUser) {
  const metadata = user.user_metadata ?? {};
  const raw =
    metadata.display_name ??
    metadata.full_name ??
    metadata.name ??
    null;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

export async function verifySupabaseAccessToken(
  accessToken: string,
  config = resolveSupabaseConfig()
): Promise<SupabaseAuthUser | null> {
  if (!config) {
    return null;
  }

  const res = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as SupabaseAuthUser;
}
