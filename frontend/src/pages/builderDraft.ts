export type BuilderScenarioId = 'price-drop' | 'price-rise' | 'large-move' | 'custom';
export type BuilderSourceMode = 'guided' | 'free_text';
export type BuilderMarket = 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE';
export type BuilderLogic = 'AND' | 'OR';
export type BuilderSensitivity = 'LOW' | 'MEDIUM' | 'HIGH';
export type BuilderIndicator = 'PRICE_CHANGE' | 'VOLUME_SURGE' | 'MA_DEVIATION' | 'RSI' | 'MACD';
export type BuilderOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'cross_up' | 'cross_down';
export type BuilderUnit = 'percent' | 'absolute';
export type BuilderDirection = 'up' | 'down';

export interface BuilderCondition {
  indicator: BuilderIndicator;
  operator: BuilderOperator;
  value: number;
  unit?: BuilderUnit;
  period?: number;
}

export interface BuilderPriceChange {
  direction: BuilderDirection;
  thresholdPercent: number;
}

export interface BuilderDraft {
  scenario: BuilderScenarioId;
  sourceMode: BuilderSourceMode;
  ticker: string;
  market: BuilderMarket;
  logic: BuilderLogic;
  sensitivity: BuilderSensitivity;
  summary: string;
  conditions: BuilderCondition[];
  priceChange?: BuilderPriceChange;
}

export interface CreateHarnessInput extends Record<string, unknown> {
  ticker: string;
  market: BuilderMarket;
  logic: BuilderLogic;
  sensitivity: BuilderSensitivity;
  summary: string;
  conditions: BuilderCondition[];
}

export interface GuidedPriceDraftInput {
  scenario: BuilderScenarioId;
  sourceMode: BuilderSourceMode;
  ticker: string;
  market: BuilderMarket;
  logic: BuilderLogic;
  sensitivity: BuilderSensitivity;
  priceChange: BuilderPriceChange;
}

export interface GuidedPriceDraftUpdate {
  ticker?: string;
  market?: BuilderMarket;
  logic?: BuilderLogic;
  sensitivity?: BuilderSensitivity;
  priceChange?: Partial<BuilderPriceChange>;
}

export function derivePriceChangeCondition(priceChange: BuilderPriceChange): BuilderCondition {
  return {
    indicator: 'PRICE_CHANGE',
    operator: priceChange.direction === 'down' ? 'lte' : 'gte',
    value: priceChange.direction === 'down' ? -priceChange.thresholdPercent : priceChange.thresholdPercent,
    unit: 'percent',
  };
}

export function derivePriceChangeSummary(ticker: string, priceChange: BuilderPriceChange): string {
  const subject = ticker.trim() || '종목';
  const movement = priceChange.direction === 'down' ? '하락' : '상승';

  return `${subject}가 ${priceChange.thresholdPercent}% 이상 ${movement}하면 알려드릴게요`;
}

export function createGuidedPriceDraft(input: GuidedPriceDraftInput): BuilderDraft {
  return {
    scenario: input.scenario,
    sourceMode: input.sourceMode,
    ticker: input.ticker,
    market: input.market,
    logic: input.logic,
    sensitivity: input.sensitivity,
    priceChange: input.priceChange,
    summary: derivePriceChangeSummary(input.ticker, input.priceChange),
    conditions: [derivePriceChangeCondition(input.priceChange)],
  };
}

export function updateGuidedPriceDraft(
  draft: BuilderDraft & { priceChange: BuilderPriceChange },
  updates: GuidedPriceDraftUpdate,
): BuilderDraft {
  const nextPriceChange: BuilderPriceChange = {
    ...draft.priceChange,
    ...(updates.priceChange ?? {}),
  };

  return createGuidedPriceDraft({
    scenario: draft.scenario,
    sourceMode: draft.sourceMode,
    ticker: updates.ticker ?? draft.ticker,
    market: updates.market ?? draft.market,
    logic: updates.logic ?? draft.logic,
    sensitivity: updates.sensitivity ?? draft.sensitivity,
    priceChange: nextPriceChange,
  });
}

export function toCreateHarnessInput(draft: BuilderDraft): CreateHarnessInput {
  return {
    ticker: draft.ticker,
    market: draft.market,
    logic: draft.logic,
    sensitivity: draft.sensitivity,
    summary: draft.summary,
    conditions: draft.conditions,
  };
}
