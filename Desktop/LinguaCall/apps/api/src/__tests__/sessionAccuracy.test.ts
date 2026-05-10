import { describe, expect, it } from 'vitest';
import { applyModeOverrides } from '../services/sessionAccuracy';
import type { SessionAccuracyPolicy } from '@lingua/shared';

const baseMockPolicy: SessionAccuracyPolicy = {
  topicLockEnabled: true,
  explicitTopicSwitchRequired: true,
  correctionMode: 'light_inline',
  maxAssistantSentences: 3,
  maxAssistantQuestionsPerTurn: 1,
  enforceTopicRetention: true,
  enforceIntentAlignment: true,
  enforceCorrectionRelevance: true,
  forbiddenDomainHints: [],
  allowedSubtopicHints: []
};

describe('applyModeOverrides', () => {
  it('practice: sets aggressive correction and maxSentences=4', () => {
    const base = { ...baseMockPolicy, enforceTopicRetention: false, maxAssistantQuestionsPerTurn: 2 };
    const result = applyModeOverrides(base, 'practice');
    expect(result.correctionMode).toBe('aggressive');
    expect(result.maxAssistantSentences).toBe(4);
    expect(result.maxAssistantQuestionsPerTurn).toBe(1);
    expect(result.enforceTopicRetention).toBe(true);
    expect(result.explicitTopicSwitchRequired).toBe(base.explicitTopicSwitchRequired);
  });

  it('real: disables correction and topicLock', () => {
    const result = applyModeOverrides(baseMockPolicy, 'real');
    expect(result.correctionMode).toBe('none');
    expect(result.maxAssistantSentences).toBe(2);
    expect(result.topicLockEnabled).toBe(false);
    expect(result.enforceTopicRetention).toBe(false);
  });

  it('mock: returns policy unchanged', () => {
    const result = applyModeOverrides(baseMockPolicy, 'mock');
    expect(result).toEqual(baseMockPolicy);
  });

  it('unknown mode: returns policy unchanged', () => {
    const result = applyModeOverrides(baseMockPolicy, 'unknown');
    expect(result).toEqual(baseMockPolicy);
  });
});
