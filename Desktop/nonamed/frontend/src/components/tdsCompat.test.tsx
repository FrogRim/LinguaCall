import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

interface MockTextProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

interface MockButtonProps extends ComponentPropsWithoutRef<'button'> {
  children?: ReactNode;
}

interface MockBadgeProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

interface MockTextFieldProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  help?: ReactNode;
}

interface MockTextAreaProps extends ComponentPropsWithoutRef<'textarea'> {
  label?: string;
  help?: ReactNode;
}

vi.mock('@toss/tds-mobile', () => ({
  Text: ({ children, ...props }: MockTextProps) => <div {...props}>{children}</div>,
  Button: ({ children, type = 'button', ...props }: MockButtonProps) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
  Badge: ({ children, ...props }: MockBadgeProps) => <div {...props}>{children}</div>,
  ProgressBar: ({ progress }: { progress: number }) => (
    <div role="progressbar" aria-valuenow={Math.round(progress * 100)} />
  ),
  TextField: ({ label, help, ...props }: MockTextFieldProps) => (
    <label>
      <span>{label}</span>
      <input aria-label={props['aria-label'] ?? label} {...props} />
      {help ? <span>{help}</span> : null}
    </label>
  ),
  TextArea: ({ label, help, ...props }: MockTextAreaProps) => (
    <label>
      <span>{label}</span>
      <textarea aria-label={props['aria-label'] ?? label} {...props} />
      {help ? <span>{help}</span> : null}
    </label>
  ),
}));

import { TextArea, TextField } from './tdsCompat';

describe('tdsCompat text inputs', () => {
  it('renders TextField with an accessible label and forwards change events', () => {
    const handleChange = vi.fn();

    render(
      <TextField
        label="종목"
        aria-label="종목"
        value="삼성전자"
        placeholder="예: 삼성전자 또는 TSLA"
        onChange={handleChange}
      />,
    );

    const input = screen.getByLabelText('종목');
    expect(input).toHaveValue('삼성전자');

    fireEvent.change(input, { target: { value: 'TSLA' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('renders TextArea with an accessible label and help text', () => {
    const handleChange = vi.fn();

    render(
      <TextArea
        label="전략 설명"
        aria-label="전략 설명"
        value="삼성전자가 많이 떨어지면 알려줘"
        help="원하는 전략을 자연어로 입력하면 AI가 조건을 정리해 드려요."
        onChange={handleChange}
      />,
    );

    const textarea = screen.getByLabelText('전략 설명');
    expect(textarea).toHaveValue('삼성전자가 많이 떨어지면 알려줘');
    expect(screen.getByText('원하는 전략을 자연어로 입력하면 AI가 조건을 정리해 드려요.')).toBeInTheDocument();
  });
});
