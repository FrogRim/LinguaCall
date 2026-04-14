import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetch = jest.fn<typeof global.fetch>();
global.fetch = mockFetch;

import {
  getFinancialMetrics,
  getLatestComparableQuarter,
  normalizeFinancialMetrics,
  parseCorpCodesXml,
  resetDartClientCachesForTests,
} from '../../src/worker/dartClient';

function toArrayBuffer(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, 'utf8');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe('dartClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    resetDartClientCachesForTests();
    delete process.env.DART_API_KEY;
    delete process.env.DART_API_BASE_URL;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('parses corp code XML into a stock-code map', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <result>
        <list>
          <corp_code>00126380</corp_code>
          <corp_name>삼성전자</corp_name>
          <stock_code>005930</stock_code>
        </list>
        <list>
          <corp_code>00164779</corp_code>
          <corp_name>SK하이닉스</corp_name>
          <stock_code>000660</stock_code>
        </list>
      </result>`;

    expect(parseCorpCodesXml(xml)).toEqual(
      new Map([
        ['005930', '00126380'],
        ['000660', '00164779'],
      ])
    );
  });

  it('returns the latest filed comparable quarter in KST', () => {
    expect(getLatestComparableQuarter(new Date('2026-03-31T00:00:00.000Z'))).toEqual({
      bsnsYear: 2025,
      reprtCode: '11014',
      asOf: '2025-Q3',
    });
    expect(getLatestComparableQuarter(new Date('2026-04-14T00:00:00.000Z'))).toEqual({
      bsnsYear: 2025,
      reprtCode: '11011',
      asOf: '2025-Q4',
    });
    expect(getLatestComparableQuarter(new Date('2026-05-01T00:00:00.000Z'))).toEqual({
      bsnsYear: 2025,
      reprtCode: '11011',
      asOf: '2025-Q4',
    });
    expect(getLatestComparableQuarter(new Date('2026-05-15T00:00:00.000Z'))).toEqual({
      bsnsYear: 2025,
      reprtCode: '11011',
      asOf: '2025-Q4',
    });
    expect(getLatestComparableQuarter(new Date('2026-05-16T00:00:00.000Z'))).toEqual({
      bsnsYear: 2026,
      reprtCode: '11013',
      asOf: '2026-Q1',
    });
    expect(getLatestComparableQuarter(new Date('2026-08-01T00:00:00.000Z'))).toEqual({
      bsnsYear: 2026,
      reprtCode: '11013',
      asOf: '2026-Q1',
    });
    expect(getLatestComparableQuarter(new Date('2026-08-15T00:00:00.000Z'))).toEqual({
      bsnsYear: 2026,
      reprtCode: '11012',
      asOf: '2026-H1',
    });
    expect(getLatestComparableQuarter(new Date('2026-11-01T00:00:00.000Z'))).toEqual({
      bsnsYear: 2026,
      reprtCode: '11012',
      asOf: '2026-H1',
    });
    expect(getLatestComparableQuarter(new Date('2026-11-15T00:00:00.000Z'))).toEqual({
      bsnsYear: 2026,
      reprtCode: '11014',
      asOf: '2026-Q3',
    });
  });

  it('normalizes annualized PER and latest-quarter operating profit growth from Q3 DART accounts', () => {
    expect(normalizeFinancialMetrics({
      currentAccounts: [
        {
          account_nm: '영업이익',
          thstrm_amount: '300',
          frmtrm_q_amount: '200',
        },
        {
          account_nm: '기본주당이익',
          thstrm_amount: '300',
          thstrm_add_amount: '900',
        },
      ],
      price: 12000,
      reportCode: '11014',
      asOf: '2025-Q3',
    })).toEqual({
      per: 10,
      operatingProfitGrowthYoY: 50,
      asOf: '2025-Q3',
    });
  });

  it('normalizes annualized PER and latest-quarter operating profit growth from H1 DART accounts', () => {
    expect(normalizeFinancialMetrics({
      currentAccounts: [
        {
          account_nm: '영업이익',
          thstrm_amount: '300',
          frmtrm_q_amount: '200',
        },
        {
          account_nm: '기본주당이익',
          thstrm_amount: '150',
          thstrm_add_amount: '300',
        },
      ],
      price: 12000,
      reportCode: '11012',
      asOf: '2025-H1',
    })).toEqual({
      per: 20,
      operatingProfitGrowthYoY: 50,
      asOf: '2025-H1',
    });
  });

  it('normalizes annualized PER and latest-quarter operating profit growth from annual Q4 DART accounts', () => {
    expect(normalizeFinancialMetrics({
      currentAccounts: [
        {
          account_nm: '영업이익',
          thstrm_amount: '400',
          frmtrm_q_amount: '250',
        },
        {
          account_nm: '기본주당이익',
          thstrm_amount: '200',
          thstrm_add_amount: '1000',
        },
      ],
      price: 12000,
      reportCode: '11011',
      asOf: '2025-Q4',
    })).toEqual({
      per: 12,
      operatingProfitGrowthYoY: 60,
      asOf: '2025-Q4',
    });
  });

  it('returns PER even when operating profit growth is unavailable', () => {
    expect(normalizeFinancialMetrics({
      currentAccounts: [
        {
          account_nm: '기본주당이익',
          thstrm_amount: '300',
          thstrm_add_amount: '900',
        },
      ],
      price: 12000,
      reportCode: '11014',
      asOf: '2025-Q3',
    })).toEqual({
      per: 10,
      operatingProfitGrowthYoY: Number.NaN,
      asOf: '2025-Q3',
    });
  });

  it('returns operating profit growth even when PER is unavailable', () => {
    expect(normalizeFinancialMetrics({
      currentAccounts: [
        {
          account_nm: '영업이익',
          thstrm_amount: '300',
          frmtrm_q_amount: '200',
        },
      ],
      price: 12000,
      reportCode: '11014',
      asOf: '2025-Q3',
    })).toEqual({
      per: Number.NaN,
      operatingProfitGrowthYoY: 50,
      asOf: '2025-Q3',
    });
  });

  it('returns null for unsupported overseas markets without calling DART', async () => {
    const metrics = await getFinancialMetrics({
      ticker: 'AAPL',
      market: 'NASDAQ',
      price: 200,
      now: new Date('2026-04-14T00:00:00.000Z'),
    });

    expect(metrics).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('caches corp code and financial base metrics across repeated requests', async () => {
    process.env.DART_API_KEY = 'test-dart-key';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`<?xml version="1.0" encoding="UTF-8"?>
          <result>
            <list>
              <corp_code>00126380</corp_code>
              <corp_name>삼성전자</corp_name>
              <stock_code>005930</stock_code>
            </list>
          </result>`),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: '000',
          list: [
            { account_nm: '영업이익', thstrm_amount: '300', frmtrm_q_amount: '200' },
            { account_nm: '기본주당이익', thstrm_amount: '300', thstrm_add_amount: '1200' },
          ],
        }),
      } as Response);

    const now = new Date('2026-04-14T00:00:00.000Z');
    const first = await getFinancialMetrics({
      ticker: '005930',
      market: 'KOSPI',
      price: 60000,
      now,
    });
    const second = await getFinancialMetrics({
      ticker: '005930',
      market: 'KOSPI',
      price: 75000,
      now,
    });

    expect(first).toEqual({
      per: 50,
      operatingProfitGrowthYoY: 50,
      asOf: '2025-Q4',
    });
    expect(second).toEqual({
      per: 62.5,
      operatingProfitGrowthYoY: 50,
      asOf: '2025-Q4',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries null financial metrics after a short cache TTL', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-14T00:00:00.000Z'));
    process.env.DART_API_KEY = 'test-dart-key';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`<?xml version="1.0" encoding="UTF-8"?>
          <result>
            <list>
              <corp_code>00126380</corp_code>
              <corp_name>삼성전자</corp_name>
              <stock_code>005930</stock_code>
            </list>
          </result>`),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: '013',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: '013',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: '000',
          list: [
            { account_nm: '영업이익', thstrm_amount: '300', frmtrm_q_amount: '200' },
            { account_nm: '기본주당이익', thstrm_amount: '300', thstrm_add_amount: '1200' },
          ],
        }),
      } as Response);

    const now = new Date('2026-04-14T00:00:00.000Z');
    const first = await getFinancialMetrics({
      ticker: '005930',
      market: 'KOSPI',
      price: 60000,
      now,
    });

    expect(first).toBeNull();

    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    const second = await getFinancialMetrics({
      ticker: '005930',
      market: 'KOSPI',
      price: 60000,
      now,
    });

    expect(second).toEqual({
      per: 50,
      operatingProfitGrowthYoY: 50,
      asOf: '2025-Q4',
    });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
