import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

export function AppShell({
  children,
  headerActions,
  className
}: {
  children: ReactNode;
  headerActions?: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <div className="relative z-40 mb-8 flex items-center justify-between gap-4 rounded-full border border-border bg-card px-4 py-3 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              LinguaCall
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">
              Short speaking practice for real routines
            </div>
          </div>
          <div className="relative z-50 flex items-center gap-2 overflow-visible">{headerActions}</div>
        </div>
        <main className={cn('flex-1 space-y-6', className)}>{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between',
        className
      )}
    >
      <div className="max-w-3xl space-y-3">
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {eyebrow}
          </div>
        )}
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function HeroSection({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-secondary p-6 shadow-sm sm:p-8',
        className
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] lg:items-end">
        <div className="space-y-4">
          {eyebrow && (
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </div>
          )}
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
          {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
        </div>
        {aside && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
