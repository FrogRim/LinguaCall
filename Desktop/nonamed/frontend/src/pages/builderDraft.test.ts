import { describe, expect, it } from 'vitest';
import {
  createGuidedPriceDraft,
  derivePriceChangeCondition,
  derivePriceChangeSummary,
  toCreateHarnessInput,
  updateGuidedPriceDraft,
  type BuilderDraft,
} from './builderDraft';
import { BUILDER_SCENARIOS, getBuilderScenario } from './builderScenarios';

describe('builderDraft', () => {
  it('maps builder draft to createHarness payload without builder-only metadata', () => {
    const draft: BuilderDraft = {
      scenario: 'price-drop',
      sourceMode: 'guided',
      ticker: '005930',
      market: 'KOSPI',
      logic: 'AND',
      sensitivity: 'MEDIUM',
      summary: '삼성전자가 5% 이상 하락하면 알려드릴게요',
      conditions: [
        {
          indicator: 'PRICE_CHANGE',
          operator: 'lte',
          value: -5,
          unit: 'percent',
        },
      ],
      priceChange: {
        direction: 'down',
        thresholdPercent: 5,
      },
    };

    expect(toCreateHarnessInput(draft)).toEqual({
      ticker: '005930',
      market: 'KOSPI',
      logic: 'AND',
      sensitivity: 'MEDIUM',
      summary: '삼성전자가 5% 이상 하락하면 알려드릴게요',
      conditions: [
        {
          indicator: 'PRICE_CHANGE',
          operator: 'lte',
          value: -5,
          unit: 'percent',
        },
      ],
    });
  });

  it('derives a downward price-change condition and summary from the same draft input', () => {
    expect(
      createGuidedPriceDraft({
        scenario: 'price-drop',
        sourceMode: 'guided',
        ticker: '삼성전자',
        market: 'KOSPI',
        logic: 'AND',
        sensitivity: 'MEDIUM',
        priceChange: {
          direction: 'down',
          thresholdPercent: 5,
        },
      }),
    ).toMatchObject({
      summary: '삼성전자가 5% 이상 하락하면 알려드릴게요',
      conditions: [
        {
          indicator: 'PRICE_CHANGE',
          operator: 'lte',
          value: -5,
          unit: 'percent',
        },
      ],
    });
  });

  it('updates summary and conditions together when the price threshold changes', () => {
    const draft = createGuidedPriceDraft({
      scenario: 'price-rise',
      sourceMode: 'guided',
      ticker: 'TSLA',
      market: 'NASDAQ',
      logic: 'AND',
      sensitivity: 'MEDIUM',
      priceChange: {
        direction: 'up',
        thresholdPercent: 5,
      },
    });

    expect(
      updateGuidedPriceDraft(
        draft as BuilderDraft & { priceChange: { direction: 'up' | 'down'; thresholdPercent: number } },
        {
          priceChange: {
            thresholdPercent: 8,
          },
          sensitivity: 'HIGH',
        },
      ),
    ).toMatchObject({
      sensitivity: 'HIGH',
      summary: 'TSLA가 8% 이상 상승하면 알려드릴게요',
      conditions: [
        {
          indicator: 'PRICE_CHANGE',
          operator: 'gte',
          value: 8,
          unit: 'percent',
        },
      ],
    });
  });

  it('derives helpers for both directions consistently', () => {
    expect(derivePriceChangeCondition({ direction: 'down', thresholdPercent: 7 })).toEqual({
      indicator: 'PRICE_CHANGE',
      operator: 'lte',
      value: -7,
      unit: 'percent',
    });
    expect(derivePriceChangeCondition({ direction: 'up', thresholdPercent: 7 })).toEqual({
      indicator: 'PRICE_CHANGE',
      operator: 'gte',
      value: 7,
      unit: 'percent',
    });
    expect(derivePriceChangeSummary('AAPL', { direction: 'up', thresholdPercent: 7 })).toBe(
      'AAPL가 7% 이상 상승하면 알려드릴게요',
    );
  });
});

describe('builderScenarios', () => {
  it('defines beginner-first scenarios for drop, rise, and large moves', () => {
    expect(BUILDER_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'price-drop',
      'price-rise',
      'large-move',
    ]);

    expect(getBuilderScenario('price-drop')).toMatchObject({
      defaultOperator: 'lte',
      indicator: 'PRICE_CHANGE',
    });
    expect(getBuilderScenario('price-rise')).toMatchObject({
      defaultOperator: 'gte',
      indicator: 'PRICE_CHANGE',
    });
    expect(getBuilderScenario('large-move')).toMatchObject({
      requiresDirectionChoice: true,
      indicator: 'PRICE_CHANGE',
    });
  });

  it('exposes scenario defaults that are compatible with the create payload shape', () => {
    for (const scenario of BUILDER_SCENARIOS) {
      expect(scenario.defaultMarket).toBe('KOSPI');
      expect(typeof scenario.defaultValue).toBe('number');
      expect(scenario.defaultValue).toBeGreaterThan(0);
      expect(scenario.indicator).toBe('PRICE_CHANGE');
    }
  });
});
