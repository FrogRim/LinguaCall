import type { ReactNode } from 'react';
import { Card } from '../ui/card';

export default function AuthLayout({
  eyebrow,
  title,
  description,
  sidebarTitle,
  sidebarCopy,
  sidebarPoints,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  sidebarTitle: string;
  sidebarCopy: string;
  sidebarPoints: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_minmax(24rem,0.85fr)] lg:items-center">
        <section className="rounded-2xl border border-border bg-secondary p-8 shadow-sm sm:p-10 lg:min-h-[34rem]">
          <div className="flex h-full flex-col justify-between gap-10">
            <div className="space-y-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                {eyebrow}
              </div>
              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {title}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>
              </div>
            </div>
            <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {sidebarTitle}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{sidebarCopy}</p>
              </div>
              <ul className="grid gap-3">
                {sidebarPoints.map(point => (
                  <li
                    key={point}
                    className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-sm">
          {children}
        </Card>
      </div>
    </div>
  );
}
