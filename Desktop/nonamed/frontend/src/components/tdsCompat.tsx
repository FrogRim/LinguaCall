import React from 'react';
import {
  Badge as TdsBadge,
  Button as TdsButton,
  ProgressBar as TdsProgressBar,
  Text as TdsText,
} from '@toss/tds-mobile';

type TextTypography = 'title1' | 'title2' | 'body1' | 'body2' | 'caption1';
type TextColor = 'primary' | 'secondary' | 'danger';
type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'small' | 'medium' | 'large';

const TYPOGRAPHY_MAP: Record<TextTypography, 't2' | 't4' | 't6' | 'st11' | 'st13'> = {
  title1: 't2',
  title2: 't4',
  body1: 't6',
  body2: 'st11',
  caption1: 'st13',
};

const COLOR_MAP: Record<TextColor, string> = {
  primary: '#3182F6',
  secondary: '#8B95A1',
  danger: '#F04452',
};

const BUTTON_SIZE_MAP: Record<ButtonSize, 'small' | 'large' | 'xlarge'> = {
  small: 'small',
  medium: 'large',
  large: 'xlarge',
};

interface TextProps {
  typography?: TextTypography;
  color?: TextColor;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Text({ typography = 'body2', color, style, children }: TextProps) {
  return (
    <TdsText typography={TYPOGRAPHY_MAP[typography]} color={color ? COLOR_MAP[color] : undefined} style={style}>
      {children}
    </TdsText>
  );
}

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  variant = 'primary',
  size = 'medium',
  style,
  children,
  type = 'button',
  onClick,
  disabled,
}: ButtonProps) {
  const display = style?.width === '100%' || style?.flex === 1 ? 'full' : undefined;

  return (
    <TdsButton
      type={type}
      color={variant === 'primary' ? 'primary' : 'light'}
      variant="fill"
      size={BUTTON_SIZE_MAP[size]}
      display={display}
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </TdsButton>
  );
}

interface BadgeProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Badge({ variant = 'primary', children }: BadgeProps) {
  return (
    <TdsBadge
      size="small"
      variant={variant === 'primary' ? 'fill' : 'weak'}
      color={variant === 'primary' ? 'blue' : 'elephant'}
    >
      {children}
    </TdsBadge>
  );
}

interface ListRowProps {
  title: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}

export function ListRow({ title, description, right, onClick }: ListRowProps) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '16px 0',
        borderBottom: '1px solid #F2F4F6',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text typography="body1">{title}</Text>
        {description ? (
          <Text typography="body2" color="secondary" style={{ marginTop: 4 }}>
            {description}
          </Text>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

interface ProgressBarProps {
  value?: number;
  progress?: number;
  size?: 'light' | 'normal' | 'bold';
}

export function ProgressBar({ value, progress, size = 'normal' }: ProgressBarProps) {
  const normalized = typeof progress === 'number' ? progress : Math.min(100, Math.max(0, value ?? 0)) / 100;

  return <TdsProgressBar progress={normalized} size={size} />;
}
