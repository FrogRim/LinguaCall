import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  parseHarnessMock,
  createHarnessMock,
  navigateMock,
  closeViewMock,
  addAccessoryButtonMock,
  removeAccessoryButtonMock,
  tdsAddEventListenerMock,
  graniteAddEventListenerMock,
} = vi.hoisted(() => ({
  parseHarnessMock: vi.fn(),
  createHarnessMock: vi.fn(),
  navigateMock: vi.fn(),
  closeViewMock: vi.fn().mockResolvedValue(undefined),
  addAccessoryButtonMock: vi.fn().mockResolvedValue(undefined),
  removeAccessoryButtonMock: vi.fn().mockResolvedValue(undefined),
  tdsAddEventListenerMock: vi.fn(() => vi.fn()),
  graniteAddEventListenerMock: vi.fn(() => vi.fn()),
}));

interface MockTextProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

interface MockButtonProps extends ComponentPropsWithoutRef<'button'> {
  children?: ReactNode;
}

vi.mock('@toss/tds-mobile', () => ({
  Text: ({ children, ...props }: MockTextProps) => <div {...props}>{children}</div>,
  Button: ({ children, type = 'button', ...props }: MockButtonProps) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
  ProgressBar: ({ progress }: { progress: number }) => (
    <div role="progressbar" aria-valuenow={Math.round(progress * 100)} />
  ),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  closeView: closeViewMock,
  partner: {
    addAccessoryButton: addAccessoryButtonMock,
    removeAccessoryButton: removeAccessoryButtonMock,
  },
  tdsEvent: {
    addEventListener: tdsAddEventListenerMock,
  },
  graniteEvent: {
    addEventListener: graniteAddEventListenerMock,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../api/client', () => ({
  api: {
    parseHarness: parseHarnessMock,
    createHarness: createHarnessMock,
  },
}));

import { Builder } from './Builder';

function renderBuilder() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Builder />
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  };
}

describe('Builder entry experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with scenario cards and keeps free-text as a secondary CTA', () => {
    renderBuilder();

    expect(screen.getByText('어떤 상황을 먼저 잡아볼까요?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /급락 알림/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /급등 알림/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /큰 변동 감지/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '직접 설명하기' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('moves to the guided question step without calling parse when a scenario is selected', () => {
    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: /급락 알림/ }));

    expect(screen.getByText('어떤 종목을 볼까요?')).toBeInTheDocument();
    expect(parseHarnessMock).not.toHaveBeenCalled();
  });

  it('preserves guided answers when returning to the scenario list and reopening the same scenario', () => {
    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: /급락 알림/ }));
    fireEvent.change(screen.getByLabelText('종목'), { target: { value: '삼성전자' } });
    fireEvent.change(screen.getByRole('slider', { name: '가격 변동 기준' }), { target: { value: '9' } });

    expect(screen.getByText('삼성전자가 9% 이상 하락하면 알려드릴게요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    fireEvent.click(screen.getByRole('button', { name: /급락 알림/ }));

    expect(screen.getByLabelText('종목')).toHaveValue('삼성전자');
    expect(screen.getByRole('slider', { name: '가격 변동 기준' })).toHaveValue('9');
    expect(screen.getByText('삼성전자가 9% 이상 하락하면 알려드릴게요')).toBeInTheDocument();
  });

  it('lets the guided path reach the sensitivity step after the user fills a ticker', () => {
    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: /급등 알림/ }));

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('종목'), { target: { value: 'TSLA' } });

    expect(screen.getByText('TSLA가 5% 이상 상승하면 알려드릴게요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByText('얼마나 예민하게 반응할까요?')).toBeInTheDocument();
  });

  it('creates a guided harness with the latest summary and sensitivity, then redirects to the dashboard', async () => {
    createHarnessMock.mockResolvedValue({ id: 'h-1' });
    const { queryClient } = renderBuilder();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: /급락 알림/ }));
    fireEvent.change(screen.getByLabelText('종목'), { target: { value: '삼성전자' } });
    fireEvent.change(screen.getByRole('slider', { name: '가격 변동 기준' }), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '기민하게 (작은 신호에도)' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByText('삼성전자가 9% 이상 하락하면 알려드릴게요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '하니스 시작하기' }));

    await waitFor(() => {
      expect(createHarnessMock).toHaveBeenCalledWith({
        ticker: '삼성전자',
        market: 'KOSPI',
        logic: 'AND',
        sensitivity: 'HIGH',
        summary: '삼성전자가 9% 이상 하락하면 알려드릴게요',
        conditions: [
          {
            indicator: 'PRICE_CHANGE',
            operator: 'lte',
            value: -9,
            unit: 'percent',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['harnesses'] });
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('lets guided users choose a market before creating a US ticker harness', async () => {
    createHarnessMock.mockResolvedValue({ id: 'h-us' });

    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: /급등 알림/ }));
    fireEvent.change(screen.getByLabelText('시장'), { target: { value: 'NASDAQ' } });
    fireEvent.change(screen.getByLabelText('종목'), { target: { value: 'TSLA' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '하니스 시작하기' }));

    await waitFor(() => {
      expect(createHarnessMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'TSLA',
          market: 'NASDAQ',
        }),
      );
    });
  });

  it('uses the latest parsed price-change tuning in the review summary and create payload', async () => {
    parseHarnessMock.mockResolvedValue({
      ticker: '삼성전자',
      market: 'KOSPI',
      logic: 'AND',
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
    createHarnessMock.mockResolvedValue({ id: 'h-2' });

    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: '직접 설명하기' }));
    fireEvent.change(screen.getByLabelText('전략 설명'), {
      target: { value: '삼성전자가 5% 이상 떨어지면 알려줘' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(parseHarnessMock).toHaveBeenCalledWith('삼성전자가 5% 이상 떨어지면 알려줘');
      expect(screen.getByText('AI가 이렇게 이해했어요')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('slider', { name: '가격 변동 기준' }), { target: { value: '-9' } });

    expect(screen.getByText('삼성전자가 9% 이상 하락하면 알려드릴게요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '기민하게 (작은 신호에도)' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '하니스 시작하기' }));

    await waitFor(() => {
      expect(createHarnessMock).toHaveBeenCalledWith({
        ticker: '삼성전자',
        market: 'KOSPI',
        logic: 'AND',
        sensitivity: 'HIGH',
        summary: '삼성전자가 9% 이상 하락하면 알려드릴게요',
        conditions: [
          {
            indicator: 'PRICE_CHANGE',
            operator: 'lte',
            value: -9,
            unit: 'percent',
          },
        ],
      });
    });
  });

  it('keeps operator and summary aligned when free-text price tuning crosses from rise to drop', async () => {
    parseHarnessMock.mockResolvedValue({
      ticker: 'TSLA',
      market: 'NASDAQ',
      logic: 'AND',
      summary: 'TSLA가 5% 이상 상승하면 알려드릴게요',
      conditions: [
        {
          indicator: 'PRICE_CHANGE',
          operator: 'gte',
          value: 5,
          unit: 'percent',
        },
      ],
    });
    createHarnessMock.mockResolvedValue({ id: 'h-3' });

    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: '직접 설명하기' }));
    fireEvent.change(screen.getByLabelText('전략 설명'), {
      target: { value: 'TSLA가 5% 이상 오르면 알려줘' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(screen.getByText('AI가 이렇게 이해했어요')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('slider', { name: '가격 변동 기준' }), { target: { value: '-9' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '하니스 시작하기' }));

    await waitFor(() => {
      expect(createHarnessMock).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'TSLA가 9% 이상 하락하면 알려드릴게요',
          conditions: [
            expect.objectContaining({
              indicator: 'PRICE_CHANGE',
              operator: 'lte',
              value: -9,
            }),
          ],
        }),
      );
    });
  });

  it('keeps free-text input and shows a recovery hint when parse fails', async () => {
    parseHarnessMock.mockRejectedValue(new Error('API Error 503'));

    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: '직접 설명하기' }));
    fireEvent.change(screen.getByLabelText('전략 설명'), {
      target: { value: '삼성전자가 많이 떨어지면 알려줘' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(screen.getByText('지금은 AI 해석이 잠시 불안정해요. 문장을 더 짧고 구체적으로 다시 적어보세요.')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('전략 설명')).toHaveValue('삼성전자가 많이 떨어지면 알려줘');
  });

  it('asks for a more concrete sentence when parse rejects the input itself', async () => {
    parseHarnessMock.mockRejectedValue(new Error('API Error 400'));

    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: '직접 설명하기' }));
    fireEvent.change(screen.getByLabelText('전략 설명'), {
      target: { value: '그냥 알려줘' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(screen.getByText('종목이나 기준을 한 가지씩 더 구체적으로 적어주세요. 예: "삼성전자가 10% 떨어지면"')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('전략 설명')).toHaveValue('그냥 알려줘');
  });

  it('shows a retry-friendly create error without losing the final review state', async () => {
    createHarnessMock.mockRejectedValue(new Error('API Error 500'));

    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: /급락 알림/ }));
    fireEvent.change(screen.getByLabelText('종목'), { target: { value: '삼성전자' } });
    fireEvent.change(screen.getByRole('slider', { name: '가격 변동 기준' }), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '기민하게 (작은 신호에도)' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    fireEvent.click(screen.getByRole('button', { name: '하니스 시작하기' }));

    await waitFor(() => {
      expect(screen.getByText('하니스를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    });

    expect(screen.getByText('삼성전자가 9% 이상 하락하면 알려드릴게요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '하니스 시작하기' })).toBeInTheDocument();
  });

  it('registers App-in-Toss back and close affordances on the builder screen', () => {
    renderBuilder();

    expect(addAccessoryButtonMock).toHaveBeenCalledWith({
      id: 'close-builder',
      title: '닫기',
      icon: { name: 'icon-close-mono' },
    });
    expect(tdsAddEventListenerMock).toHaveBeenCalledWith(
      'navigationAccessoryEvent',
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
    expect(graniteAddEventListenerMock).toHaveBeenCalledWith(
      'backEvent',
      expect.objectContaining({ onEvent: expect.any(Function) }),
    );
  });

  it('navigates back to the dashboard when the App-in-Toss back event fires', () => {
    renderBuilder();

    const backRegistration = graniteAddEventListenerMock.mock.calls[0] as unknown as
      | [string, { onEvent: () => void }]
      | undefined;
    const backHandler = backRegistration?.[1].onEvent;

    backHandler?.();

    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('closes the App-in-Toss view when the close accessory event fires', async () => {
    renderBuilder();

    const accessoryRegistration = tdsAddEventListenerMock.mock.calls[0] as unknown as
      | [string, { onEvent: (data: { id: string }) => void }]
      | undefined;
    const accessoryHandler = accessoryRegistration?.[1].onEvent;

    accessoryHandler?.({ id: 'close-builder' });

    await waitFor(() => {
      expect(closeViewMock).toHaveBeenCalledTimes(1);
    });
  });
});
