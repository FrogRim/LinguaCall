import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MatchEvaluationDetail } from '../../src/llm/schema';
import { formatMatchSummaryFallback, generateMatchSummary } from '../../src/llm/matchSummary';

const mockFetch = jest.fn<typeof global.fetch>();
global.fetch = mockFetch;

const details: MatchEvaluationDetail[] = [
  {
    indicator: 'PRICE_CHANGE',
    operator: 'lte',
    target: -5,
    actual: -5.2,
    triggered: true,
    unit: 'percent',
  },
  {
    indicator: 'VOLUME_SURGE',
    operator: 'gte',
    target: 200,
    actual: 250,
    triggered: true,
    unit: 'percent',
  },
];

describe('formatMatchSummaryFallback', () => {
  it('creates a deterministic beginner-friendly summary', () => {
    const result = formatMatchSummaryFallback({
      ticker: '005930',
      market: 'KOSPI',
      price: 71200,
      harnessSummary: '삼성전자가 많이 빠지면 알려드려요.',
      details,
    });

    expect(result).toContain('삼성전자가 많이 빠지면 알려드려요.');
    expect(result).toContain('KOSPI 005930 가격은 71,200원');
    expect(result).toContain('가격 변동률이 -5.2%');
  });

  it('uses USD-friendly wording for overseas fallback summary', () => {
    const result = formatMatchSummaryFallback({
      ticker: 'AAPL',
      market: 'NASDAQ',
      price: 192.34,
      harnessSummary: '애플이 많이 빠지면 알려드려요.',
      details,
    });

    expect(result).toContain('NASDAQ AAPL 가격은 192.34달러');
    expect(result).not.toContain('원');
  });
});

describe('generateMatchSummary', () => {
  const originalApiKey = process.env.LLM_API_KEY;
  const originalApiUrl = process.env.LLM_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_API_URL = 'https://api.example.com/v1/chat/completions';
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = originalApiKey;
    }

    if (originalApiUrl === undefined) {
      delete process.env.LLM_API_URL;
    } else {
      process.env.LLM_API_URL = originalApiUrl;
    }
  });

  it('returns fallback when LLM config is unavailable', async () => {
    delete process.env.LLM_API_KEY;

    const result = await generateMatchSummary({
      ticker: '005930',
      market: 'KOSPI',
      price: 71200,
      harnessSummary: '삼성전자가 많이 빠지면 알려드려요.',
      details,
    });

    expect(result).toContain('삼성전자가 많이 빠지면 알려드려요.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns fallback when LLM call fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await generateMatchSummary({
      ticker: '005930',
      market: 'KOSPI',
      price: 71200,
      harnessSummary: '삼성전자가 많이 빠지면 알려드려요.',
      details,
    });

    expect(result).toContain('가격 변동률이 -5.2%');
  });

  it('returns LLM content on success', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '삼성전자가 하락 조건을 충족해 알림을 보냅니다.' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await generateMatchSummary({
      ticker: '005930',
      market: 'KOSPI',
      price: 71200,
      harnessSummary: '삼성전자가 많이 빠지면 알려드려요.',
      details,
    });

    expect(result).toBe('삼성전자가 하락 조건을 충족해 알림을 보냅니다.');
  });
});
