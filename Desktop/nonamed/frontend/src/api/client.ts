import type { Harness } from '../types/harness';

export type AppLoginReferrer = 'DEFAULT' | 'SANDBOX';

export interface LoginResponse {
  sessionToken: string;
  plan: string;
}

export interface LoginBootstrapResponse {
  sessionToken: string;
  plan: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let sessionToken = '';

export function setSessionToken(token: string) {
  sessionToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  if (sessionToken && !('Authorization' in headers)) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  if (options.body !== undefined && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  login: (userKey: string) =>
    request<LoginResponse>('/users', { method: 'POST', body: JSON.stringify({ tossUserKey: userKey }) }),

  loginWithAuthorizationCode: (authorizationCode: string, referrer: AppLoginReferrer) =>
    request<LoginBootstrapResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ authorizationCode, referrer }),
    }),

  parseHarness: (input: string) =>
    request('/harnesses/parse', { method: 'POST', body: JSON.stringify({ input }) }),

  getHarnesses: () => request<Harness[]>('/harnesses'),

  createHarness: (data: Record<string, unknown>) =>
    request('/harnesses', { method: 'POST', body: JSON.stringify(data) }),

  toggleHarness: (id: string, active: boolean) =>
    request(`/harnesses/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  deleteHarness: (id: string) =>
    request(`/harnesses/${id}`, { method: 'DELETE' }),

  getAlerts: () => request<unknown[]>('/alerts'),

  clickAlert: (id: string) =>
    request(`/alerts/${id}/click`, { method: 'POST' }),
};
