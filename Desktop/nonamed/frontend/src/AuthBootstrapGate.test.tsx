import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthBootstrapGate } from './AuthBootstrapGate';

const { mockBootstrapAuth } = vi.hoisted(() => ({
  mockBootstrapAuth: vi.fn(),
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
}));

vi.mock('./bootstrapAuth', () => ({
  bootstrapAuth: mockBootstrapAuth,
}));

describe('AuthBootstrapGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading message before bootstrap completes', () => {
    mockBootstrapAuth.mockReturnValue(new Promise(() => {}));

    render(
      <AuthBootstrapGate>
        <div>앱 콘텐츠</div>
      </AuthBootstrapGate>,
    );

    expect(screen.getByText('앱 인증을 준비하고 있어요...')).toBeInTheDocument();
    expect(screen.queryByText('앱 콘텐츠')).not.toBeInTheDocument();
  });

  it('renders children after bootstrap succeeds', async () => {
    mockBootstrapAuth.mockResolvedValue({ sessionToken: 'session-token', plan: 'FREE' });

    render(
      <AuthBootstrapGate>
        <div>앱 콘텐츠</div>
      </AuthBootstrapGate>,
    );

    await waitFor(() => {
      expect(screen.getByText('앱 콘텐츠')).toBeInTheDocument();
    });
  });

  it('shows loading UI again immediately when retry starts', async () => {
    let resolveRetry: ((value: { sessionToken: string; plan: string }) => void) | undefined;

    mockBootstrapAuth
      .mockRejectedValueOnce(new Error('API Error 500'))
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveRetry = resolve;
        }),
      );

    render(
      <AuthBootstrapGate>
        <div>앱 콘텐츠</div>
      </AuthBootstrapGate>,
    );

    await waitFor(() => {
      expect(screen.getByText('앱 인증에 실패했어요')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('앱 인증을 준비하고 있어요...')).toBeInTheDocument();
    expect(screen.queryByText('앱 콘텐츠')).not.toBeInTheDocument();

    resolveRetry?.({ sessionToken: 'session-token', plan: 'FREE' });

    await waitFor(() => {
      expect(screen.getByText('앱 콘텐츠')).toBeInTheDocument();
    });
  });

  it('shows retry UI when bootstrap fails and retries on click', async () => {
    mockBootstrapAuth
      .mockRejectedValueOnce(new Error('API Error 500'))
      .mockResolvedValueOnce({ sessionToken: 'session-token', plan: 'FREE' });

    render(
      <AuthBootstrapGate>
        <div>앱 콘텐츠</div>
      </AuthBootstrapGate>,
    );

    await waitFor(() => {
      expect(screen.getByText('앱 인증에 실패했어요')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(screen.getByText('앱 콘텐츠')).toBeInTheDocument();
    });

    expect(mockBootstrapAuth).toHaveBeenCalledTimes(2);
  });
});
