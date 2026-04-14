import { callLLMText } from './parser';
import type { MatchEvaluationDetail, ParsedHarness } from './schema';

const SYSTEM_PROMPT = `
당신은 초보 투자자에게 주식 알림 이유를 쉽게 설명하는 도우미입니다.
아래 입력을 바탕으로 2문장 이내의 자연스러운 한국어 요약만 작성하세요.
과장된 표현, 투자 권유, JSON, 마크다운은 사용하지 마세요.
반드시 현재 가격과 왜 알림이 울렸는지 포함하세요.
`.trim();

type Market = ParsedHarness['market'];

export interface MatchSummaryInput {
  ticker: string;
  market: Market;
  price: number;
  harnessSummary: string;
  details: MatchEvaluationDetail[];
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString('ko-KR');
  }
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatValue(value: number, unit?: 'percent' | 'absolute'): string {
  if (unit === 'percent') {
    return `${formatNumber(value)}%`;
  }
  return formatNumber(value);
}

function describeIndicator(detail: MatchEvaluationDetail): string {
  const periodLabel = detail.period ? `${detail.period}일 ` : '';

  switch (detail.indicator) {
    case 'PRICE_CHANGE':
      return `가격 변동률이 ${formatValue(detail.actual, 'percent')}로 ${formatOperator(detail.operator, formatValue(detail.target, 'percent'))}`;
    case 'VOLUME_SURGE':
      return `거래량이 전일 대비 ${formatValue(detail.actual, 'percent')}로 ${formatOperator(detail.operator, formatValue(detail.target, 'percent'))}`;
    case 'RSI':
      return `${periodLabel}RSI가 ${formatValue(detail.actual)}로 ${formatOperator(detail.operator, formatValue(detail.target))}`;
    case 'MA_DEVIATION':
      return `${periodLabel}이동평균 이격도가 ${formatValue(detail.actual, 'percent')}로 ${formatOperator(detail.operator, formatValue(detail.target, 'percent'))}`;
    case 'MACD':
      if (detail.operator === 'cross_up') {
        return `MACD선이 시그널선을 상향 돌파했습니다 (MACD ${formatValue(detail.actual)})`;
      }
      if (detail.operator === 'cross_down') {
        return `MACD선이 시그널선을 하향 이탈했습니다 (MACD ${formatValue(detail.actual)})`;
      }
      return `MACD가 ${formatValue(detail.actual)}로 ${formatOperator(detail.operator, formatValue(detail.target))}`;
    default:
      return `조건이 충족되었습니다`;
  }
}

function formatOperator(operator: MatchEvaluationDetail['operator'], target: string): string {
  switch (operator) {
    case 'gte':
      return `${target} 이상이 되었습니다`;
    case 'lte':
      return `${target} 이하가 되었습니다`;
    case 'gt':
      return `${target}보다 커졌습니다`;
    case 'lt':
      return `${target}보다 작아졌습니다`;
    case 'cross_up':
      return `${target}을 상향 돌파했습니다`;
    case 'cross_down':
      return `${target}을 하향 이탈했습니다`;
    default:
      return `${target} 조건을 만족했습니다`;
  }
}

function formatPriceLabel(ticker: string, price: number, market: Market): string {
  if (market === 'NASDAQ' || market === 'NYSE') {
    return `현재 ${market} ${ticker} 가격은 ${formatNumber(price)}달러`;
  }

  return `현재 ${market} ${ticker} 가격은 ${formatNumber(price)}원`;
}

export function formatMatchSummaryFallback({ ticker, market, price, harnessSummary, details }: MatchSummaryInput): string {
  const triggeredDetails = details.filter((detail) => detail.triggered);
  const reasons = (triggeredDetails.length > 0 ? triggeredDetails : details)
    .slice(0, 2)
    .map(describeIndicator)
    .join(' ');

  return `${harnessSummary} ${formatPriceLabel(ticker, price, market)}이며, ${reasons}`;
}

function buildPrompt(input: MatchSummaryInput): string {
  const detailLines = input.details.map((detail, index) => {
    return `${index + 1}. 지표=${detail.indicator}, 연산자=${detail.operator}, 목표=${detail.target}, 실제=${detail.actual}, 충족=${detail.triggered}, 단위=${detail.unit ?? 'absolute'}, 기간=${detail.period ?? '없음'}`;
  }).join('\n');

  return [
    `종목: ${input.ticker}`,
    `시장: ${input.market}`,
    `현재가: ${input.price}`,
    `기존 하니스 요약: ${input.harnessSummary}`,
    '충족 여부 상세:',
    detailLines,
  ].join('\n');
}

async function callSummaryLLM(input: MatchSummaryInput): Promise<string> {
  const content = await callLLMText([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildPrompt(input) },
  ]);

  return content.trim();
}

export async function generateMatchSummary(input: MatchSummaryInput): Promise<string> {
  try {
    return await callSummaryLLM(input);
  } catch {
    return formatMatchSummaryFallback(input);
  }
}
