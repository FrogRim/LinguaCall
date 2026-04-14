import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetch = jest.fn<typeof global.fetch>();
global.fetch = mockFetch;

import {
  getStockByTicker,
  getStockList,
  parseKrxCorpListHtml,
  resetStockListCacheForTests,
  searchStocksByName,
} from '../../src/worker/stockList';

function toArrayBuffer(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, 'utf8');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function bytesToArrayBuffer(bytes: number[]): ArrayBuffer {
  const buffer = Buffer.from(bytes);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

const eucKrSamsungCorpListBytes = [60, 116, 97, 98, 108, 101, 62, 60, 116, 114, 62, 60, 116, 104, 62, 200, 184, 187, 231, 184, 237, 60, 47, 116, 104, 62, 60, 116, 104, 62, 190, 247, 193, 190, 60, 47, 116, 104, 62, 60, 116, 104, 62, 193, 190, 184, 241, 196, 218, 181, 229, 60, 47, 116, 104, 62, 60, 47, 116, 114, 62, 60, 116, 114, 62, 60, 116, 100, 62, 187, 239, 188, 186, 192, 252, 192, 218, 60, 47, 116, 100, 62, 60, 116, 100, 62, 192, 252, 177, 226, 192, 252, 192, 218, 60, 47, 116, 100, 62, 60, 116, 100, 62, 48, 48, 53, 57, 51, 48, 60, 47, 116, 100, 62, 60, 47, 116, 114, 62, 60, 47, 116, 97, 98, 108, 101, 62];

describe('stockList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStockListCacheForTests();
  });

  it('parses KRX corp list HTML into normalized stock entries', () => {
    const html = `
      <table>
        <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
        <tr>
          <td>삼성전자</td>
          <td>전기전자</td>
          <td>5930</td>
        </tr>
        <tr>
          <td>SK하이닉스</td>
          <td>반도체</td>
          <td>000660</td>
        </tr>
      </table>`;

    expect(parseKrxCorpListHtml(html, 'KOSPI')).toEqual([
      { ticker: '005930', name: '삼성전자', market: 'KOSPI' },
      { ticker: '000660', name: 'SK하이닉스', market: 'KOSPI' },
    ]);
  });

  it('caches merged KOSPI and KOSDAQ stock lists across repeated requests', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`
          <table>
            <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
            <tr><td>Samsung Electronics</td><td>Hardware</td><td>005930</td></tr>
          </table>`),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`
          <table>
            <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
            <tr><td>Kakao Games</td><td>Games</td><td>293490</td></tr>
          </table>`),
      } as Response);

    const first = await getStockList();
    const second = await getStockList();

    expect(first).toEqual([
      { ticker: '005930', name: 'Samsung Electronics', market: 'KOSPI' },
      { ticker: '293490', name: 'Kakao Games', market: 'KOSDAQ' },
    ]);
    expect(second).toEqual(first);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent stock list refreshes while the cache is cold', async () => {
    let resolveKospi!: (value: Response) => void;
    let resolveKosdaq!: (value: Response) => void;

    const kospiResponse = new Promise<Response>((resolve) => {
      resolveKospi = resolve;
    });
    const kosdaqResponse = new Promise<Response>((resolve) => {
      resolveKosdaq = resolve;
    });

    mockFetch
      .mockReturnValueOnce(kospiResponse)
      .mockReturnValueOnce(kosdaqResponse);

    const first = getStockList();
    const second = getStockList();

    expect(mockFetch).toHaveBeenCalledTimes(2);

    resolveKospi({
      ok: true,
      arrayBuffer: async () => toArrayBuffer(`
        <table>
          <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
          <tr><td>Samsung Electronics</td><td>Hardware</td><td>005930</td></tr>
        </table>`),
    } as Response);
    resolveKosdaq({
      ok: true,
      arrayBuffer: async () => toArrayBuffer(`
        <table>
          <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
          <tr><td>Kakao Games</td><td>Games</td><td>293490</td></tr>
        </table>`),
    } as Response);

    await expect(first).resolves.toEqual([
      { ticker: '005930', name: 'Samsung Electronics', market: 'KOSPI' },
      { ticker: '293490', name: 'Kakao Games', market: 'KOSDAQ' },
    ]);
    await expect(second).resolves.toEqual([
      { ticker: '005930', name: 'Samsung Electronics', market: 'KOSPI' },
      { ticker: '293490', name: 'Kakao Games', market: 'KOSDAQ' },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('decodes EUC-KR KRX responses before parsing company names', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bytesToArrayBuffer(eucKrSamsungCorpListBytes),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer('<table></table>'),
      } as Response);

    await expect(getStockList()).resolves.toEqual([
      { ticker: '005930', name: '삼성전자', market: 'KOSPI' },
    ]);
  });

  it('finds an exact stock by ticker with zero-padding normalization', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`
          <table>
            <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
            <tr><td>Samsung Electronics</td><td>Hardware</td><td>005930</td></tr>
          </table>`),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`
          <table>
            <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
            <tr><td>Kakao Games</td><td>Games</td><td>293490</td></tr>
          </table>`),
      } as Response);

    await expect(getStockByTicker('5930')).resolves.toEqual({
      ticker: '005930',
      name: 'Samsung Electronics',
      market: 'KOSPI',
    });
  });

  it('searches by company name with an optional market filter', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`
          <table>
            <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
            <tr><td>Samsung Electronics</td><td>Hardware</td><td>005930</td></tr>
            <tr><td>Samsung Biologics</td><td>Pharma</td><td>207940</td></tr>
          </table>`),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => toArrayBuffer(`
          <table>
            <tr><th>회사명</th><th>업종</th><th>종목코드</th></tr>
            <tr><td>Samsung Publishing</td><td>Media</td><td>068290</td></tr>
          </table>`),
      } as Response);

    await expect(searchStocksByName('Samsung')).resolves.toEqual([
      { ticker: '005930', name: 'Samsung Electronics', market: 'KOSPI' },
      { ticker: '207940', name: 'Samsung Biologics', market: 'KOSPI' },
      { ticker: '068290', name: 'Samsung Publishing', market: 'KOSDAQ' },
    ]);
    await expect(searchStocksByName('Samsung', { market: 'KOSDAQ' })).resolves.toEqual([
      { ticker: '068290', name: 'Samsung Publishing', market: 'KOSDAQ' },
    ]);
  });
});
