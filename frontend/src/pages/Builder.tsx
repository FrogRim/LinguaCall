import { useEffect, useState } from 'react';
import { closeView, graniteEvent, partner, tdsEvent } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, ProgressBar, Text } from '../components/tdsCompat';
import { api } from '../api/client';
import { ConditionSlider } from '../components/ConditionSlider';
import { SummaryCard } from '../components/SummaryCard';
import {
  createGuidedPriceDraft,
  derivePriceChangeCondition,
  derivePriceChangeSummary,
  toCreateHarnessInput,
  updateGuidedPriceDraft,
  type BuilderCondition,
  type BuilderDirection,
  type BuilderDraft,
  type BuilderMarket,
  type BuilderPriceChange,
  type BuilderSensitivity,
  type GuidedPriceDraftUpdate,
} from './builderDraft';
import { BUILDER_SCENARIOS, getBuilderScenario } from './builderScenarios';

type EntryMode = 'guided' | 'free_text';
type Sensitivity = BuilderSensitivity;

const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  LOW: '둔감하게 (큰 신호만)',
  MEDIUM: '적당하게',
  HIGH: '기민하게 (작은 신호에도)',
};

interface ParsedHarness {
  ticker: string;
  market: BuilderMarket;
  conditions: BuilderCondition[];
  logic: BuilderDraft['logic'];
  summary: string;
}

function getScenarioDirection(scenarioId: BuilderDraft['scenario']): BuilderDirection {
  const scenario = getBuilderScenario(scenarioId);
  return scenario.defaultOperator === 'lte' || scenario.defaultOperator === 'lt' ? 'down' : 'up';
}

function getErrorStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;

  const match = error.message.match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function getParseErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);

  if (status === 400) {
    return '종목이나 기준을 한 가지씩 더 구체적으로 적어주세요. 예: "삼성전자가 10% 떨어지면"';
  }

  if (status === 503) {
    return '지금은 AI 해석이 잠시 불안정해요. 문장을 더 짧고 구체적으로 다시 적어보세요.';
  }

  return '좀 더 구체적으로 말씀해 주실 수 있나요? 예: "10% 떨어지면" 또는 "과매도 구간에 오면"';
}

function getCreateErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);

  if (status !== null && status < 500) {
    return '입력한 조건을 다시 확인해 주세요. 저장은 아직 되지 않았어요.';
  }

  return '하니스를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function Builder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [entryMode, setEntryMode] = useState<EntryMode>('guided');
  const [input, setInput] = useState('');
  const [guidedDraft, setGuidedDraft] = useState<BuilderDraft | null>(null);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('MEDIUM');
  const [errorMsg, setErrorMsg] = useState('');

  const parseMutation = useMutation({
    mutationFn: () => api.parseHarness(input) as Promise<ParsedHarness>,
    onSuccess: (data) => {
      setGuidedDraft({
        scenario: 'custom',
        sourceMode: 'free_text',
        ticker: data.ticker,
        market: data.market as BuilderDraft['market'],
        logic: data.logic as BuilderDraft['logic'],
        sensitivity,
        summary: data.summary,
        conditions: data.conditions,
        priceChange:
          data.conditions.length === 1 && data.conditions[0]?.indicator === 'PRICE_CHANGE'
            ? {
                direction: data.conditions[0].value < 0 ? 'down' : 'up',
                thresholdPercent: Math.abs(data.conditions[0].value),
              }
            : undefined,
      });
      setErrorMsg('');
      setStep(2);
    },
    onError: (error) => {
      setErrorMsg(getParseErrorMessage(error));
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!guidedDraft) {
        throw new Error('Draft is required before creating a harness');
      }

      return api.createHarness(toCreateHarnessInput(guidedDraft));
    },
    onMutate: () => setErrorMsg(''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['harnesses'] });
      navigate('/dashboard');
    },
    onError: (error) => {
      setErrorMsg(getCreateErrorMessage(error));
    },
  });

  const updateConditionValue = (index: number, value: number) => {
    setGuidedDraft((current) => {
      if (!current) return current;

      const newConditions = current.conditions.map((condition, currentIndex) => {
        if (currentIndex !== index) {
          return condition;
        }

        if (condition.indicator === 'PRICE_CHANGE') {
          return {
            ...condition,
            ...derivePriceChangeCondition({
              direction: value < 0 ? 'down' : 'up',
              thresholdPercent: Math.abs(value),
            }),
          };
        }

        return { ...condition, value };
      });

      const priceChangeCondition = newConditions.find((condition) => condition.indicator === 'PRICE_CHANGE');
      const nextSummary =
        current.sourceMode === 'free_text' &&
        priceChangeCondition &&
        typeof priceChangeCondition.value === 'number'
          ? derivePriceChangeSummary(current.ticker, {
              direction: priceChangeCondition.value < 0 ? 'down' : 'up',
              thresholdPercent: Math.abs(priceChangeCondition.value),
            })
          : current.summary;

      return {
        ...current,
        summary: nextSummary,
        conditions: newConditions,
      };
    });
  };

  const updateGuidedDraft = (updates: GuidedPriceDraftUpdate) => {
    setGuidedDraft((current) => {
      if (!current?.priceChange) return current;

      return updateGuidedPriceDraft(
        current as BuilderDraft & { priceChange: BuilderPriceChange },
        updates,
      );
    });
  };

  const handleScenarioSelect = (scenarioId: BuilderDraft['scenario']) => {
    const scenario = getBuilderScenario(scenarioId);

    setEntryMode('guided');
    setGuidedDraft((current) => {
      if (current?.scenario === scenario.id) {
        return current;
      }

      return createGuidedPriceDraft({
        scenario: scenario.id,
        sourceMode: 'guided',
        ticker: '',
        market: scenario.defaultMarket,
        logic: 'AND',
        sensitivity: scenario.defaultSensitivity,
        priceChange: {
          direction: getScenarioDirection(scenario.id),
          thresholdPercent: scenario.defaultValue,
        },
      });
    });
    setSensitivity((current) =>
      guidedDraft?.scenario === scenario.id ? current : scenario.defaultSensitivity,
    );
    setErrorMsg('');
    setStep(2);
  };

  const handleSensitivitySelect = (nextSensitivity: Sensitivity) => {
    setSensitivity(nextSensitivity);

    if (guidedDraft) {
      setGuidedDraft({
        ...guidedDraft,
        sensitivity: nextSensitivity,
      });
    }
  };

  useEffect(() => {
    const handleClose = () => {
      void closeView().catch(() => undefined);
    };

    void partner
      .addAccessoryButton({
        id: 'close-builder',
        title: '닫기',
        icon: { name: 'icon-close-mono' },
      })
      .catch(() => undefined);

    const removeAccessoryListener = tdsEvent.addEventListener('navigationAccessoryEvent', {
      onEvent: ({ id }) => {
        if (id === 'close-builder') {
          handleClose();
        }
      },
    });

    const removeBackListener = graniteEvent.addEventListener('backEvent', {
      onEvent: () => {
        navigate('/dashboard');
      },
    });

    return () => {
      removeAccessoryListener();
      removeBackListener();
      void partner.removeAccessoryButton().catch(() => undefined);
    };
  }, [navigate]);

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <ProgressBar progress={step / 4} size="normal" />

      {step === 1 && entryMode === 'guided' && (
        <div style={{ marginTop: 16 }}>
          <Text typography="title2">어떤 상황을 먼저 잡아볼까요?</Text>
          <Text typography="body2" color="secondary" style={{ marginTop: 8 }}>
            초보자도 카드만 고르면 바로 시작할 수 있어요.
          </Text>

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {BUILDER_SCENARIOS.map((scenario) => (
              <Button
                key={scenario.id}
                variant="secondary"
                size="large"
                onClick={() => handleScenarioSelect(scenario.id)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <span>{scenario.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 400 }}>{scenario.description}</span>
                </div>
              </Button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="large"
            style={{ marginTop: 16, width: '100%' }}
            onClick={() => {
              setEntryMode('free_text');
              setErrorMsg('');
            }}
          >
            직접 설명하기
          </Button>
        </div>
      )}

      {step === 1 && entryMode === 'free_text' && (
        <div style={{ marginTop: 16 }}>
          <Text typography="title2">직접 설명해 주세요</Text>
          <Text typography="body2" color="secondary" style={{ marginTop: 8 }}>
            원하는 전략을 자연어로 입력하면 AI가 조건을 정리해 드려요.
          </Text>
          <textarea
            aria-label="전략 설명"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="예: 삼전이 많이 떨어지면 알려줘"
            style={{
              width: '100%',
              height: 100,
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              fontSize: 14,
              resize: 'none',
              boxSizing: 'border-box',
            }}
          />
          {errorMsg && (
            <Text typography="body2" color="danger" style={{ marginTop: 8 }}>
              {errorMsg}
            </Text>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button
              variant="secondary"
              size="large"
              style={{ flex: 1 }}
              onClick={() => {
                setEntryMode('guided');
                setErrorMsg('');
              }}
            >
              추천 시나리오로 시작하기
            </Button>
            <Button
              variant="primary"
              size="large"
              style={{ flex: 1 }}
              onClick={() => parseMutation.mutate()}
              disabled={!input.trim() || parseMutation.isPending}
            >
              {parseMutation.isPending ? 'AI가 분석 중이에요...' : '다음'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && entryMode === 'guided' && guidedDraft?.priceChange && (
        <div style={{ marginTop: 16 }}>
          <Text typography="title2">어떤 종목을 볼까요?</Text>
          <Text typography="body2" color="secondary" style={{ marginTop: 8 }}>
            종목과 기준값만 정하면 바로 하니스를 만들 수 있어요.
          </Text>
          <select
            aria-label="시장"
            value={guidedDraft.market}
            onChange={(event) => updateGuidedDraft({ market: event.target.value as BuilderMarket })}
            style={{
              width: '100%',
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              fontSize: 14,
              boxSizing: 'border-box',
              background: '#FFF',
            }}
          >
            <option value="KOSPI">KOSPI</option>
            <option value="KOSDAQ">KOSDAQ</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="NYSE">NYSE</option>
          </select>
          <input
            aria-label="종목"
            value={guidedDraft.ticker}
            onChange={(event) => updateGuidedDraft({ ticker: event.target.value })}
            placeholder="예: 삼성전자 또는 TSLA"
            style={{
              width: '100%',
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />

          {getBuilderScenario(guidedDraft.scenario).requiresDirectionChoice && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button
                variant={guidedDraft.priceChange.direction === 'down' ? 'primary' : 'secondary'}
                size="large"
                style={{ flex: 1 }}
                onClick={() => updateGuidedDraft({ priceChange: { direction: 'down' } })}
              >
                하락 감지
              </Button>
              <Button
                variant={guidedDraft.priceChange.direction === 'up' ? 'primary' : 'secondary'}
                size="large"
                style={{ flex: 1 }}
                onClick={() => updateGuidedDraft({ priceChange: { direction: 'up' } })}
              >
                상승 감지
              </Button>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <ConditionSlider
              label="가격 변동 기준"
              min={1}
              max={20}
              value={guidedDraft.priceChange.thresholdPercent}
              unit="%"
              onChange={(value) => updateGuidedDraft({ priceChange: { thresholdPercent: value } })}
            />
          </div>

          <SummaryCard summary={guidedDraft.summary} />

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" size="large" onClick={() => setStep(1)} style={{ flex: 1 }}>
              이전
            </Button>
            <Button
              variant="primary"
              size="large"
              onClick={() => setStep(3)}
              disabled={!guidedDraft.ticker.trim()}
              style={{ flex: 1 }}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {step === 2 && entryMode === 'free_text' && guidedDraft && (
        <div style={{ marginTop: 16 }}>
          <Text typography="title2">AI가 이렇게 이해했어요</Text>
          <SummaryCard summary={guidedDraft.summary} />
          {guidedDraft.conditions
            .map((condition, index) => ({ condition, index }))
            .filter(({ condition }) => condition.indicator === 'PRICE_CHANGE')
            .map(({ condition, index }) => (
              <ConditionSlider
                key={index}
                label="가격 변동 기준"
                min={Math.min(-20, condition.value)}
                max={Math.max(-1, condition.value)}
                value={condition.value}
                unit="%"
                onChange={(value) => updateConditionValue(index, value)}
              />
            ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" size="large" onClick={() => setStep(1)} style={{ flex: 1 }}>
              이전
            </Button>
            <Button variant="primary" size="large" onClick={() => setStep(3)} style={{ flex: 1 }}>
              다음
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 16 }}>
          <Text typography="title2">얼마나 예민하게 반응할까요?</Text>
          {(['LOW', 'MEDIUM', 'HIGH'] as Sensitivity[]).map((value) => (
            <Button
              key={value}
              variant={sensitivity === value ? 'primary' : 'secondary'}
              size="large"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => handleSensitivitySelect(value)}
            >
              {SENSITIVITY_LABELS[value]}
            </Button>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" size="large" onClick={() => setStep(2)} style={{ flex: 1 }}>
              이전
            </Button>
            <Button variant="primary" size="large" onClick={() => setStep(4)} style={{ flex: 1 }}>
              다음
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ marginTop: 16 }}>
          <Text typography="title2">하니스를 시작할까요?</Text>
          <SummaryCard summary={guidedDraft?.summary ?? ''} />
          {errorMsg && (
            <Text typography="body2" color="danger" style={{ marginBottom: 8 }}>
              {errorMsg}
            </Text>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" size="large" onClick={() => setStep(3)} style={{ flex: 1 }}>
              이전
            </Button>
            <Button
              variant="primary"
              size="large"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              style={{ flex: 1 }}
            >
              {createMutation.isPending ? '생성 중...' : '하니스 시작하기'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
