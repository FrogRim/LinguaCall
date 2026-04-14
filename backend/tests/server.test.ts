import { afterEach, describe, expect, it } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { buildServer, resolveBackgroundServicesMode } from '../src/server';

const originalNodeEnv = process.env.NODE_ENV;
let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('buildServer security headers', () => {
  it('adds baseline security headers to API responses in non-production', async () => {
    process.env.NODE_ENV = 'development';
    app = buildServer();

    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('adds HSTS in production without breaking App-in-Toss CORS preflight', async () => {
    process.env.NODE_ENV = 'production';
    app = buildServer();

    const healthRes = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.headers['strict-transport-security']).toContain('max-age=');

    const corsRes = await app.inject({
      method: 'OPTIONS',
      url: '/users',
      headers: {
        origin: 'https://mini.apps.tossmini.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(corsRes.statusCode).toBe(204);
    expect(corsRes.headers['access-control-allow-origin']).toBe('https://mini.apps.tossmini.com');
    expect(corsRes.headers['strict-transport-security']).toContain('max-age=');
  });
});

describe('buildServer CORS', () => {
  it('allows localhost preflight requests in non-production', async () => {
    process.env.NODE_ENV = 'development';
    app = buildServer();

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/users',
      headers: {
        origin: 'http://127.0.0.1:4174',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:4174');
  });

  it('allows localhost delete preflight requests for bearer-authenticated harness removal in non-production', async () => {
    process.env.NODE_ENV = 'development';
    app = buildServer();

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/harnesses/test-id',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'DELETE',
        'access-control-request-headers': 'content-type,authorization',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect((res.headers['access-control-allow-headers'] ?? '').toLowerCase()).toContain('authorization');
  });
});

describe('resolveBackgroundServicesMode', () => {
  it('skips background services in non-production when KIS env is missing', () => {
    expect(resolveBackgroundServicesMode({ NODE_ENV: 'development' })).toBe('skip');
  });

  it('starts background services when KIS env is present', () => {
    expect(resolveBackgroundServicesMode({
      NODE_ENV: 'development',
      KIS_WS_URL: 'ws://example.com',
      KIS_APPROVAL_KEY: 'approval-key',
    })).toBe('start');
  });

  it('throws in production when KIS env is missing', () => {
    expect(() => resolveBackgroundServicesMode({ NODE_ENV: 'production' })).toThrow(
      'KIS_WS_URL and KIS_APPROVAL_KEY must be set in production',
    );
  });
});
