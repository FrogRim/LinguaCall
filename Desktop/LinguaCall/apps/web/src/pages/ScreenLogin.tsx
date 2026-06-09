import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CreditCard, PlayCircle } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';
import { StatusBanner } from '../components/layout/SectionCard';
import { Button } from '../components/ui/button';
import { getFriendlyCopy } from '../content/friendlyCopy';
import { useUser } from '../context/UserContext';
import { describeApiError } from '../lib/api';
import { getHostRuntime } from '../lib/hostRuntime';

export default function ScreenLogin() {
  const { i18n } = useTranslation();
  const { isAuthenticated, sessionChecked, startDemoSession } = useUser();
  const navigate = useNavigate();
  const copy = getFriendlyCopy(i18n.language);
  const hostRuntime = getHostRuntime();
  const billingCta = hostRuntime.platform === 'apps-in-toss'
    ? copy.login.secondaryCtaAppsInToss
    : copy.login.secondaryCta;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionChecked && isAuthenticated) {
      navigate('/session');
    }
  }, [isAuthenticated, navigate, sessionChecked]);

  const handleDemoStart = async () => {
    setLoading(true);
    setError('');
    try {
      await startDemoSession();
      navigate('/session');
    } catch (err) {
      setError(describeApiError(err, 'demo_login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={copy.login.eyebrow}
      title={copy.login.title}
      description={copy.login.description}
      sidebarTitle={copy.login.valueTitle}
      sidebarCopy={copy.login.valueSummary}
      sidebarPoints={copy.login.bullets}
    >
      <div className="space-y-7 px-8 py-8 sm:px-10 sm:py-10">
        <div className="space-y-2">
          <div className="inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            LinguaCall
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            {copy.common.quickPractice}
          </h2>
        </div>

        <div className="grid gap-3">
          <Button size="lg" className="w-full gap-2" onClick={() => void handleDemoStart()} disabled={loading}>
            <PlayCircle className="h-4 w-4" />
            <span>{loading ? copy.login.primaryCtaLoading : copy.login.primaryCta}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate('/billing')}
          >
            <CreditCard className="h-4 w-4" />
            <span>{billingCta}</span>
          </Button>
        </div>

        {error && <StatusBanner tone="danger">{error}</StatusBanner>}

        <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-6 text-muted-foreground">
          {copy.login.valueSummary}
        </div>
      </div>
    </AuthLayout>
  );
}
