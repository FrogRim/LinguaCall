import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

type MockUser = {
  id: string;
  tossUserKey: string;
  plan: string;
};

type MockUpsert = (input: unknown) => Promise<MockUser>;

const mockUpsert = jest.fn<MockUpsert>();

jest.mock('../../src/db/client', () => ({
  prisma: {
    user: {
      upsert: mockUpsert,
    },
  },
}));

import { verifySessionToken } from '../../src/api/auth';
import { buildServer } from '../../src/server';

const TEST_USER_KEY = 'test-user-key';
const mockFetch = jest.fn<typeof global.fetch>();
global.fetch = mockFetch;

describe('User API', () => {
  let app: FastifyInstance;

  beforeAll(() => { app = buildServer(); });
  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({
      id: 'user-id',
      tossUserKey: TEST_USER_KEY,
      plan: 'FREE',
    });
  });

  describe('POST /users', () => {
    it('creates user on first local-dev login and returns a session token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { tossUserKey: TEST_USER_KEY },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ sessionToken: string; plan: string }>();
      expect(body.plan).toBe('FREE');
      expect(typeof body.sessionToken).toBe('string');
      expect(verifySessionToken(body.sessionToken)).toMatchObject({ sub: 'user-id' });
    });

    it('rejects direct tossUserKey bootstrap from non-local clients in non-production', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          host: 'preview.example.com',
          origin: 'https://preview.example.com',
        },
        remoteAddress: '203.0.113.10',
        payload: { tossUserKey: TEST_USER_KEY },
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects direct tossUserKey bootstrap in production', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const res = await app.inject({
          method: 'POST',
          url: '/users',
          payload: { tossUserKey: TEST_USER_KEY },
        });

        expect(res.statusCode).toBe(403);
      } finally {
        if (previousNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = previousNodeEnv;
        }
      }
    });
  });

  describe('POST /users/login', () => {
    it('exchanges authorizationCode and returns a signed session token with plan', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          userKey: TEST_USER_KEY,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));

      const res = await app.inject({
        method: 'POST',
        url: '/users/login',
        payload: {
          authorizationCode: 'auth-code',
          referrer: 'DEFAULT',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ sessionToken: string; plan: string }>();
      expect(body.plan).toBe('FREE');
      expect(typeof body.sessionToken).toBe('string');
      expect(verifySessionToken(body.sessionToken)).toMatchObject({ sub: 'user-id' });
    });

    it('rejects invalid request body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users/login',
        payload: {
          authorizationCode: '',
          referrer: 'UNKNOWN',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
