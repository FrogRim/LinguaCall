import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../ui/cn';

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn('rounded-2xl border-border bg-card shadow-sm', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div className="space-y-2">
          <CardTitle className="text-xl tracking-tight text-foreground">{title}</CardTitle>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </CardHeader>
      <CardContent className={cn('space-y-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function MetricCard({
  label,
  value,
  tone = 'default',
  detail
}: {
  label: string;
  value: string;
  tone?: 'default' | 'primary';
  detail?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-4',
        tone === 'primary'
          ? 'border-primary/20 bg-primary/5 text-foreground'
          : 'border-border bg-secondary text-foreground'
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {detail && <div className="mt-1 text-sm text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function StatusBanner({
  children,
  tone = 'neutral'
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
        tone === 'danger' && 'border-destructive/20 bg-destructive/10 text-destructive',
        tone === 'neutral' && 'border-border bg-background text-foreground'
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary px-5 py-8 text-center">
      <div className="space-y-2">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
