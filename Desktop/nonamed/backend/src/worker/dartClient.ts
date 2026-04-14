import { inflateRawSync } from 'zlib';
import type { ParsedHarness } from '../llm/schema';

const DEFAULT_DART_API_BASE_URL = 'https://opendart.fss.or.kr/api';
const CORP_CODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FINANCIAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FINANCIAL_NULL_CACHE_TTL_MS = 5 * 60 * 1000;
const OPERATING_PROFIT_ACCOUNT_NAMES = ['영업이익', '영업이익(손실)'];
const EPS_ACCOUNT_NAMES = ['기본주당이익', '희석주당이익', '주당순이익'];

type DomesticMarket = Extract<ParsedHarness['market'], 'KOSPI' | 'KOSDAQ'>;
type ReportCode = '11011' | '11013' | '11012' | '11014';

interface ReportSpec {
  bsnsYear: number;
  reprtCode: ReportCode;
  asOf: string;
}

interface DartAccountRow {
  account_nm?: string;
  thstrm_amount?: string | null;
  thstrm_add_amount?: string | null;
  frmtrm_q_amount?: string | null;
}

interface DartFinancialResponse {
  status?: string;
  list?: DartAccountRow[];
}

interface FinancialBaseMetrics {
  eps: number;
  operatingProfitGrowthYoY: number;
  asOf: string;
}

export interface FinancialMetrics {
  per: number;
  operatingProfitGrowthYoY: number;
  asOf: string;
}

export interface GetFinancialMetricsParams {
  ticker: string;
  market: ParsedHarness['market'];
  price: number;
  now?: Date;
}

let corpCodeCacheExpiresAt = 0;
let corpCodeByTicker = new Map<string, string>();
const financialBaseCache = new Map<string, { expiresAt: number; value: FinancialBaseMetrics | null }>();

function getDartApiBaseUrl(): string {
  return process.env.DART_API_BASE_URL ?? DEFAULT_DART_API_BASE_URL;
}

function buildDartUrl(pathname: string, params: Record<string, string>): string {
  const baseUrl = getDartApiBaseUrl();
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(pathname, normalizedBaseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function isDomesticMarket(market: ParsedHarness['market']): market is DomesticMarket {
  return market === 'KOSPI' || market === 'KOSDAQ';
}

function parseNumber(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }

  const normalized = value.replace(/,/g, '').replace(/\s+/g, '');
  if (!normalized || normalized === '-') {
    return Number.NaN;
  }

  return Number.parseFloat(normalized);
}

function findAccountRow(rows: DartAccountRow[], accountNames: readonly string[]): DartAccountRow | undefined {
  for (const accountName of accountNames) {
    const row = rows.find((candidate) => candidate.account_nm === accountName);
    if (row) {
      return row;
    }
  }

  return undefined;
}

function findAccountAmount(rows: DartAccountRow[], accountNames: readonly string[]): number {
  const amount = parseNumber(findAccountRow(rows, accountNames)?.thstrm_amount);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function findPreviousYearQuarterAmount(rows: DartAccountRow[], accountNames: readonly string[]): number {
  const amount = parseNumber(findAccountRow(rows, accountNames)?.frmtrm_q_amount);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function calculateOperatingProfitGrowthYoY(rows: DartAccountRow[]): number {
  const currentOperatingProfit = findAccountAmount(rows, OPERATING_PROFIT_ACCOUNT_NAMES);
  const previousYearQuarterOperatingProfit = findPreviousYearQuarterAmount(rows, OPERATING_PROFIT_ACCOUNT_NAMES);

  if (!Number.isFinite(currentOperatingProfit) || !Number.isFinite(previousYearQuarterOperatingProfit) || previousYearQuarterOperatingProfit === 0) {
    return Number.NaN;
  }

  return ((currentOperatingProfit - previousYearQuarterOperatingProfit) / Math.abs(previousYearQuarterOperatingProfit)) * 100;
}

function annualizeEps(rows: DartAccountRow[], reportCode: ReportCode): number {
  const epsRow = findAccountRow(rows, EPS_ACCOUNT_NAMES);
  const cumulativeEps = parseNumber(epsRow?.thstrm_add_amount);
  const termEps = parseNumber(epsRow?.thstrm_amount);

  switch (reportCode) {
    case '11011':
      return Number.isFinite(cumulativeEps)
        ? cumulativeEps
        : termEps;
    case '11013': {
      const q1Eps = Number.isFinite(cumulativeEps)
        ? cumulativeEps
        : termEps;
      return Number.isFinite(q1Eps) ? q1Eps * 4 : Number.NaN;
    }
    case '11012':
      return Number.isFinite(cumulativeEps) ? cumulativeEps * 2 : Number.NaN;
    case '11014':
      return Number.isFinite(cumulativeEps) ? cumulativeEps * (4 / 3) : Number.NaN;
    default:
      return Number.NaN;
  }
}

export function getLatestComparableQuarter(now: Date): ReportSpec {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();

  if (month > 11 || (month === 11 && day >= 15)) {
    return { bsnsYear: year, reprtCode: '11014', asOf: `${year}-Q3` };
  }
  if (month > 8 || (month === 8 && day >= 15)) {
    return { bsnsYear: year, reprtCode: '11012', asOf: `${year}-H1` };
  }
  if (month > 5 || (month === 5 && day >= 16)) {
    return { bsnsYear: year, reprtCode: '11013', asOf: `${year}-Q1` };
  }
  if (month > 4 || (month === 4 && day >= 1)) {
    return { bsnsYear: year - 1, reprtCode: '11011', asOf: `${year - 1}-Q4` };
  }

  return { bsnsYear: year - 1, reprtCode: '11014', asOf: `${year - 1}-Q3` };
}

function decodeCorpCodePayload(buffer: Buffer): string {
  const asText = buffer.toString('utf8');
  if (asText.trimStart().startsWith('<?xml')) {
    return asText;
  }

  if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Unexpected corpCode payload format');
  }

  const compressionMethod = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const fileNameLength = buffer.readUInt16LE(26);
  const extraFieldLength = buffer.readUInt16LE(28);
  const dataStart = 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataStart + compressedSize;
  const compressed = buffer.subarray(dataStart, dataEnd);

  if (compressionMethod === 0) {
    return compressed.toString('utf8');
  }
  if (compressionMethod === 8) {
    return inflateRawSync(compressed).toString('utf8');
  }

  throw new Error(`Unsupported corpCode compression method: ${compressionMethod}`);
}

export function parseCorpCodesXml(xml: string): Map<string, string> {
  const result = new Map<string, string>();
  const listBlocks = xml.match(/<list>[\s\S]*?<\/list>/g) ?? [];

  for (const block of listBlocks) {
    const corpCode = block.match(/<corp_code>(.*?)<\/corp_code>/)?.[1]?.trim();
    const stockCode = block.match(/<stock_code>(.*?)<\/stock_code>/)?.[1]?.trim();

    if (corpCode && stockCode) {
      result.set(stockCode, corpCode);
    }
  }

  return result;
}

export function normalizeFinancialMetrics({
  currentAccounts,
  price,
  reportCode,
  asOf,
}: {
  currentAccounts: DartAccountRow[];
  price: number;
  reportCode: ReportCode;
  asOf: string;
}): FinancialMetrics | null {
  const annualizedEps = annualizeEps(currentAccounts, reportCode);
  const operatingProfitGrowthYoY = calculateOperatingProfitGrowthYoY(currentAccounts);
  const per = annualizedEps > 0 && Number.isFinite(price)
    ? price / annualizedEps
    : Number.NaN;

  if (!Number.isFinite(per) && !Number.isFinite(operatingProfitGrowthYoY)) {
    return null;
  }

  return {
    per,
    operatingProfitGrowthYoY,
    asOf,
  };
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DART API error: ${response.status} ${response.statusText}`);
  }

  const body = await response.arrayBuffer();
  return Buffer.from(body);
}

async function fetchFinancialStatement(
  corpCode: string,
  report: ReportSpec,
  fsDiv: 'OFS' | 'CFS'
): Promise<DartAccountRow[] | null> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    return null;
  }

  const url = buildDartUrl('fnlttSinglAcntAll.json', {
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: String(report.bsnsYear),
    reprt_code: report.reprtCode,
    fs_div: fsDiv,
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DART API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as DartFinancialResponse;
  if (data.status !== '000' || !Array.isArray(data.list)) {
    return null;
  }

  return data.list;
}

async function getCorpCode(ticker: string): Promise<string | null> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    return null;
  }

  const now = Date.now();
  if (now < corpCodeCacheExpiresAt && corpCodeByTicker.size > 0) {
    return corpCodeByTicker.get(ticker) ?? null;
  }

  const url = buildDartUrl('corpCode.xml', { crtfc_key: apiKey });
  const payload = await fetchBuffer(url);
  const xml = decodeCorpCodePayload(payload);
  corpCodeByTicker = parseCorpCodesXml(xml);
  corpCodeCacheExpiresAt = now + CORP_CODE_CACHE_TTL_MS;

  return corpCodeByTicker.get(ticker) ?? null;
}

async function getFinancialBaseMetrics(corpCode: string, report: ReportSpec): Promise<FinancialBaseMetrics | null> {
  const cacheKey = `${corpCode}:${report.bsnsYear}:${report.reprtCode}`;
  const cached = financialBaseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let value: FinancialBaseMetrics | null = null;

  for (const fsDiv of ['OFS', 'CFS'] as const) {
    const currentAccounts = await fetchFinancialStatement(corpCode, report, fsDiv);

    if (!currentAccounts) {
      continue;
    }

    const annualizedEps = annualizeEps(currentAccounts, report.reprtCode);
    const operatingProfitGrowthYoY = calculateOperatingProfitGrowthYoY(currentAccounts);

    if (!Number.isFinite(annualizedEps) && !Number.isFinite(operatingProfitGrowthYoY)) {
      continue;
    }

    value = {
      eps: annualizedEps,
      operatingProfitGrowthYoY,
      asOf: report.asOf,
    };
    break;
  }

  financialBaseCache.set(cacheKey, {
    expiresAt: Date.now() + (value ? FINANCIAL_CACHE_TTL_MS : FINANCIAL_NULL_CACHE_TTL_MS),
    value,
  });

  return value;
}

export async function getFinancialMetrics({
  ticker,
  market,
  price,
  now = new Date(),
}: GetFinancialMetricsParams): Promise<FinancialMetrics | null> {
  if (!isDomesticMarket(market)) {
    return null;
  }
  if (!process.env.DART_API_KEY) {
    return null;
  }

  const corpCode = await getCorpCode(ticker);
  if (!corpCode) {
    return null;
  }

  const report = getLatestComparableQuarter(now);
  const baseMetrics = await getFinancialBaseMetrics(corpCode, report);
  if (!baseMetrics) {
    return null;
  }

  return {
    per: baseMetrics.eps > 0 && Number.isFinite(price)
      ? price / baseMetrics.eps
      : Number.NaN,
    operatingProfitGrowthYoY: baseMetrics.operatingProfitGrowthYoY,
    asOf: baseMetrics.asOf,
  };
}

export function resetDartClientCachesForTests(): void {
  corpCodeCacheExpiresAt = 0;
  corpCodeByTicker = new Map<string, string>();
  financialBaseCache.clear();
}
