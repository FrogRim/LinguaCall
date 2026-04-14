import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAlertCreate = jest.fn<() => Promise<unknown>>();
type MockFetch = (url: string, options?: unknown) => Promise<Response>;
const mockFetch = jest.fn<MockFetch>();

jest.mock('../../src/db/client', () => ({
  prisma: {
    alert: {
      create: mockAlertCreate,
    },
  },
}));

jest.mock('node-fetch', () => mockFetch);

import { sendPush } from '../../src/pusher/pushClient';

describe('sendPush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockFetch.mockResolvedValue(new Response('', { status: 200 }));
    mockAlertCreate.mockResolvedValue({ id: 'alert-id' });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('uses the prepared summary in push payload', async () => {
    const delivered = await sendPush({
      userKey: 'user-key',
      harness: { id: 'h1', userId: 'u1' },
      summary: '준비된 요약 문구',
      price: 71200,
      deeplink: 'supertoss://stock?code=005930&market=KOSPI',
    });

    expect(delivered).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(options.body);

    expect(payload.context.summary).toBe('준비된 요약 문구');
    expect(mockAlertCreate).toHaveBeenCalledWith({
      data: {
        harnessId: 'h1',
        userId: 'u1',
        triggeredBy: 'HARNESS',
        priceAt: 71200,
        deeplink: 'supertoss://stock?code=005930&market=KOSPI',
      },
    });
  });

  it('returns true without retrying when push delivery succeeds but alert audit write fails', async () => {
    jest.useFakeTimers();
    mockAlertCreate.mockRejectedValueOnce(new Error('db write failed'));

    const deliveryPromise = sendPush({
      userKey: 'user-key',
      harness: { id: 'h1', userId: 'u1' },
      summary: '감사 로그 실패 요약',
      price: 71200,
      deeplink: 'supertoss://stock?code=005930&market=KOSPI',
    });

    await jest.runAllTimersAsync();
    const delivered = await deliveryPromise;

    expect(delivered).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockAlertCreate).toHaveBeenCalledTimes(1);
  });

  it('returns false and records HARNESS_FAILED after terminal delivery failure', async () => {
    jest.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('network down'));

    const deliveryPromise = sendPush({
      userKey: 'user-key',
      harness: { id: 'h1', userId: 'u1' },
      summary: '실패 요약',
      price: 71200,
      deeplink: 'supertoss://stock?code=005930&market=KOSPI',
    });

    await jest.runAllTimersAsync();
    const delivered = await deliveryPromise;

    expect(delivered).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockAlertCreate).toHaveBeenCalledTimes(1);
    expect(mockAlertCreate).toHaveBeenCalledWith({
      data: {
        harnessId: 'h1',
        userId: 'u1',
        triggeredBy: 'HARNESS_FAILED',
        priceAt: 71200,
        deeplink: 'supertoss://stock?code=005930&market=KOSPI',
      },
    });
  });
});
