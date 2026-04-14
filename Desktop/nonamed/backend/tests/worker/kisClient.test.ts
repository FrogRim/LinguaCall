import { describe, expect, it } from '@jest/globals';

process.env.KIS_WS_URL ??= 'wss://example.test';
process.env.KIS_APPROVAL_KEY ??= 'test-approval-key';

const { getRealtimeSubscriptionPayload, parseDomesticTick, parseOverseasDelayedTick } = require('../../src/worker/kisClient') as typeof import('../../src/worker/kisClient');

describe('getRealtimeSubscriptionPayload', () => {
  it('uses domestic realtime subscription for Korean markets', () => {
    expect(getRealtimeSubscriptionPayload('005930', 'KOSPI')).toEqual({
      trId: 'H0STCNT0',
      trKey: '005930',
    });
  });

  it('uses delayed overseas subscription for NASDAQ and NYSE', () => {
    expect(getRealtimeSubscriptionPayload('AAPL', 'NASDAQ')).toEqual({
      trId: 'HDFSCNT0',
      trKey: 'BAQAAPL',
    });
    expect(getRealtimeSubscriptionPayload('IBM', 'NYSE')).toEqual({
      trId: 'HDFSCNT0',
      trKey: 'BAYIBM',
    });
  });
});

describe('parseDomesticTick', () => {
  it('parses domestic websocket fields', () => {
    const fields = Array.from({ length: 26 }, () => '');
    fields[0] = '005930';
    fields[2] = '71200';
    fields[13] = '1500';
    fields[14] = '1000';
    fields[25] = '75000';

    expect(parseDomesticTick(fields)).toEqual({
      ticker: '005930',
      tick: {
        price: 71200,
        prevClose: 75000,
        volume: 1500,
        prevVolume: 1000,
      },
    });
  });
});

describe('parseOverseasDelayedTick', () => {
  it('parses overseas delayed websocket fields using RATE directly', () => {
    const fields = Array.from({ length: 20 }, () => '');
    fields[0] = 'AAPL';
    fields[10] = '192.34';
    fields[13] = '-5.12';
    fields[19] = '987654';

    expect(parseOverseasDelayedTick(fields)).toEqual({
      ticker: 'AAPL',
      tick: {
        price: 192.34,
        prevClose: Number.NaN,
        volume: 987654,
        prevVolume: 1,
        percentChange: -5.12,
      },
    });
  });

  it('returns null for malformed overseas delayed websocket fields', () => {
    const fields = Array.from({ length: 20 }, () => '');
    fields[0] = 'AAPL';
    fields[10] = '192.34';
    fields[19] = '987654';

    expect(parseOverseasDelayedTick(fields)).toBeNull();
  });
});
