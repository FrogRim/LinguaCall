import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { buildServer } from '../../src/server';
import { prisma } from '../../src/db/client';
import { issueSessionToken } from '../../src/api/auth';
import type { FastifyInstance } from 'fastify';

const TEST_USER_KEY = 'harness-test-user';

const mockHarness = {
  ticker: '005930',
  market: 'KOSPI',
  conditions: [{ indicator: 'PRICE_CHANGE', operator: 'lte', value: -5, unit: 'percent' }],
  logic: 'OR',
  sensitivity: 'MEDIUM',
  summary: '삼성전자가 5% 하락하면 알려드려요',
};

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueSessionToken(userId)}` };
}

describe('Harness API', () => {
  let app: FastifyInstance;
  let userId: string;

  beforeAll(() => { app = buildServer(); });
  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    const user = await prisma.user.upsert({
      where: { tossUserKey: TEST_USER_KEY },
      update: {},
      create: { tossUserKey: TEST_USER_KEY },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.harness.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { tossUserKey: TEST_USER_KEY } });
  });

  it('creates a harness', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/harnesses',
      headers: authHeaders(userId),
      payload: mockHarness,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ ticker: string; active: boolean }>();
    expect(body.ticker).toBe('005930');
    expect(body.active).toBe(true);
  });

  it('rejects raw x-toss-user-key headers on protected routes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/harnesses',
      headers: { 'x-toss-user-key': TEST_USER_KEY },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed bearer tokens on protected routes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/harnesses',
      headers: { authorization: 'Bearer not-a-valid-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects forged bearer tokens on protected routes', async () => {
    const validToken = issueSessionToken(userId);
    const forgedToken = `${validToken.slice(0, -1)}${validToken.endsWith('a') ? 'b' : 'a'}`;

    const res = await app.inject({
      method: 'GET',
      url: '/harnesses',
      headers: { authorization: `Bearer ${forgedToken}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects when FREE plan exceeds 3 harnesses', async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/harnesses',
        headers: authHeaders(userId),
        payload: { ...mockHarness, ticker: `00000${i}` },
      });
    }
    const res = await app.inject({
      method: 'POST',
      url: '/harnesses',
      headers: authHeaders(userId),
      payload: mockHarness,
    });
    expect(res.statusCode).toBe(403);
  });

  it('lists harnesses for user', async () => {
    await app.inject({
      method: 'POST',
      url: '/harnesses',
      headers: authHeaders(userId),
      payload: mockHarness,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/harnesses',
      headers: authHeaders(userId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(body).toHaveLength(1);
  });

  it('deletes a harness', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/harnesses',
      headers: authHeaders(userId),
      payload: mockHarness,
    });
    const { id } = created.json<{ id: string }>();

    const res = await app.inject({
      method: 'DELETE',
      url: `/harnesses/${id}`,
      headers: authHeaders(userId),
    });
    expect(res.statusCode).toBe(200);
  });
});
