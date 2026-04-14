import type { BuilderMarket, BuilderOperator, BuilderScenarioId, BuilderSensitivity } from './builderDraft';

export interface BuilderScenario {
  id: BuilderScenarioId;
  title: string;
  description: string;
  indicator: 'PRICE_CHANGE';
  defaultOperator: BuilderOperator;
  defaultValue: number;
  defaultMarket: BuilderMarket;
  defaultSensitivity: BuilderSensitivity;
  requiresDirectionChoice: boolean;
}

export const BUILDER_SCENARIOS: BuilderScenario[] = [
  {
    id: 'price-drop',
    title: '급락 알림',
    description: '원하는 종목이 크게 떨어질 때 빠르게 알려드려요.',
    indicator: 'PRICE_CHANGE',
    defaultOperator: 'lte',
    defaultValue: 5,
    defaultMarket: 'KOSPI',
    defaultSensitivity: 'MEDIUM',
    requiresDirectionChoice: false,
  },
  {
    id: 'price-rise',
    title: '급등 알림',
    description: '원하는 종목이 빠르게 오를 때 흐름을 놓치지 않게 도와드려요.',
    indicator: 'PRICE_CHANGE',
    defaultOperator: 'gte',
    defaultValue: 5,
    defaultMarket: 'KOSPI',
    defaultSensitivity: 'MEDIUM',
    requiresDirectionChoice: false,
  },
  {
    id: 'large-move',
    title: '큰 변동 감지',
    description: '위아래 어느 방향이든 크게 움직일 때 먼저 포착해요.',
    indicator: 'PRICE_CHANGE',
    defaultOperator: 'gte',
    defaultValue: 7,
    defaultMarket: 'KOSPI',
    defaultSensitivity: 'MEDIUM',
    requiresDirectionChoice: true,
  },
];

export function getBuilderScenario(id: BuilderScenarioId): BuilderScenario {
  const scenario = BUILDER_SCENARIOS.find((candidate) => candidate.id === id);

  if (!scenario) {
    throw new Error(`Unknown builder scenario: ${id}`);
  }

  return scenario;
}
