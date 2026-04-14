import { TextDecoder } from 'util';
import type { ParsedHarness } from '../llm/schema';

const KRX_CORP_LIST_URL = 'https://kind.krx.co.kr/corpgeneral/corpList.do';
const STOCK_LIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EUC_KR_DECODER = new TextDecoder('euc-kr');

const KRX_MARKET_TYPE_BY_MARKET: Record<DomesticStockMarket, string> = {
  KOSPI: 'stockMkt',
  KOSDAQ: 'kosdaqMkt',
};

type DomesticStockMarket = Extract<ParsedHarness['market'], 'KOSPI' | 'KOSDAQ'>;

export interface StockListEntry {
  ticker: string;
  name: string;
  market: DomesticStockMarket;
}

let stockListCacheExpiresAt = 0;
let stockListCache: StockListEntry[] = [];
let stockListLoadPromise: Promise<StockListEntry[]> | null = null;

function normalizeTicker(ticker: string): string {
  const digits = ticker.replace(/\D/g, '');
  return digits.padStart(6, '0');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlTableRows(html: string): string[][] {
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));

  return rows
    .map((rowMatch) => Array.from(rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi))
      .map((cellMatch) => stripHtml(cellMatch[1])))
    .filter((cells) => cells.length > 0);
}

function getHeaderIndexes(rows: string[][]): { nameIndex: number; tickerIndex: number } {
  for (const cells of rows) {
    const nameIndex = cells.findIndex((cell) => cell.includes('회사명'));
    const tickerIndex = cells.findIndex((cell) => cell.includes('종목코드'));

    if (nameIndex >= 0 && tickerIndex >= 0) {
      return { nameIndex, tickerIndex };
    }
  }

  return { nameIndex: -1, tickerIndex: -1 };
}

export function parseKrxCorpListHtml(html: string, market: DomesticStockMarket): StockListEntry[] {
  const rows = parseHtmlTableRows(html);
  const { nameIndex, tickerIndex } = getHeaderIndexes(rows);
  const entries: StockListEntry[] = [];

  for (const cells of rows) {
    if (cells.some((cell) => cell.includes('회사명') || cell.includes('종목코드'))) {
      continue;
    }

    const rawName = nameIndex >= 0 ? cells[nameIndex] : cells.find((cell) => !/^\d{1,6}$/.test(cell));
    const rawTicker = tickerIndex >= 0 ? cells[tickerIndex] : cells.find((cell) => /^\d{1,6}$/.test(cell));

    if (!rawName || !rawTicker) {
      continue;
    }

    const ticker = normalizeTicker(rawTicker);
    if (!/^\d{6}$/.test(ticker)) {
      continue;
    }

    entries.push({
      ticker,
      name: rawName,
      market,
    });
  }

  return entries;
}

function buildKrxCorpListUrl(market: DomesticStockMarket): string {
  const url = new URL(KRX_CORP_LIST_URL);
  url.searchParams.set('method', 'download');
  url.searchParams.set('marketType', KRX_MARKET_TYPE_BY_MARKET[market]);
  return url.toString();
}

async function fetchKrxCorpListHtml(market: DomesticStockMarket): Promise<string> {
  const response = await fetch(buildKrxCorpListUrl(market));
  if (!response.ok) {
    throw new Error(`KRX corp list error: ${response.status} ${response.statusText}`);
  }

  const body = await response.arrayBuffer();
  return EUC_KR_DECODER.decode(body);
}

async function loadStockList(): Promise<StockListEntry[]> {
  const [kospiHtml, kosdaqHtml] = await Promise.all([
    fetchKrxCorpListHtml('KOSPI'),
    fetchKrxCorpListHtml('KOSDAQ'),
  ]);

  stockListCache = [
    ...parseKrxCorpListHtml(kospiHtml, 'KOSPI'),
    ...parseKrxCorpListHtml(kosdaqHtml, 'KOSDAQ'),
  ];
  stockListCacheExpiresAt = Date.now() + STOCK_LIST_CACHE_TTL_MS;

  return [...stockListCache];
}

export async function getStockList(): Promise<StockListEntry[]> {
  const now = Date.now();
  if (now < stockListCacheExpiresAt && stockListCache.length > 0) {
    return [...stockListCache];
  }

  if (!stockListLoadPromise) {
    stockListLoadPromise = loadStockList().finally(() => {
      stockListLoadPromise = null;
    });
  }

  return [...await stockListLoadPromise];
}

export async function getStockByTicker(ticker: string): Promise<StockListEntry | null> {
  const normalizedTicker = normalizeTicker(ticker);
  const stocks = await getStockList();
  return stocks.find((stock) => stock.ticker === normalizedTicker) ?? null;
}

export async function searchStocksByName(
  nameQuery: string,
  options?: { market?: DomesticStockMarket }
): Promise<StockListEntry[]> {
  const normalizedQuery = nameQuery.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const stocks = await getStockList();
  return stocks.filter((stock) => {
    if (options?.market && stock.market !== options.market) {
      return false;
    }

    return stock.name.toLocaleLowerCase().includes(normalizedQuery);
  });
}

export function resetStockListCacheForTests(): void {
  stockListCacheExpiresAt = 0;
  stockListCache = [];
  stockListLoadPromise = null;
}
