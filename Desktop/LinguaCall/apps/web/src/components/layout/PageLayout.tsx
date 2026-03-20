import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/card';

interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tighter text-foreground">{t('common.appName')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('common.appTagline')}</p>
        </div>
        <Card className="shadow-sm border-border overflow-hidden">
          {children}
        </Card>
      </div>
    </div>
  );
}
