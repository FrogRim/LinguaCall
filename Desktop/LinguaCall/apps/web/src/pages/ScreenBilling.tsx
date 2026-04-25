import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AppsInTossPaymentLaunchSession, UserSubscription, BillingPlan } from '@lingua/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../components/ui/cn';
import { StatusBanner } from '../components/layout/SectionCard';
import { useUser } from '../context/UserContext';
import { apiClient, describeApiError } from '../lib/api';
import LanguagePicker from '../components/ui/LanguagePicker';
import { getFriendlyCopy } from '../content/friendlyCopy';
import { readBillingReturnState, startAppsInTossBillingLaunch } from '../features/billing/checkout';
import { canLaunchAppsInTossPayment, HostBridgeError } from '../lib/hostBridge';
import { getHostRuntime } from '../lib/hostRuntime';

export default function ScreenBilling() {
  const { i18n, t } = useTranslation();
  const { getToken, refreshSession } = useUser();
  const navigate = useNavigate();

  const returnState = readBillingReturnState(window.location.href);
  const { checkoutResult, hasLegacyReturn } = returnState;
  const copy = getFriendlyCopy(i18n.language);
  const hostRuntime = getHostRuntime();
  const appsInTossAvailable = canLaunchAppsInTossPayment(hostRuntime);
  const hostNotice = appsInTossAvailable
    ? copy.billing.appsInTossReadyNotice
    : hostRuntime.platform === 'unknown' || hostRuntime.platform === 'apps-in-toss'
      ? copy.billing.hostUnavailableNotice
      : '';
  const legacyNotice = hasLegacyReturn
    ? checkoutResult === 'success'
      ? copy.billing.legacyReturnSuccessNotice
      : checkoutResult === 'cancel'
        ? copy.billing.legacyReturnCancelNotice
        : copy.billing.legacyReturnNotice
    : '';

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [launchingPlanCode, setLaunchingPlanCode] = useState('');

  const load = useCallback(async () => {
    const api = apiClient(getToken, refreshSession);
    setLoading(true);
    setError('');
    try {
      const [sub, planList] = await Promise.all([
        api.get<UserSubscription | null>('/billing/subscription'),
        api.get<BillingPlan[]>('/billing/plans')
      ]);
      setSubscription(sub);
      setPlans(planList);
    } catch (err) {
      setError(describeApiError(err, 'billing_load'));
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshSession]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hasLegacyReturn) return;
    const cleanUrl = `${window.location.pathname}${window.location.hash.split('?')[0]}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, [hasLegacyReturn]);

  const handlePlanLaunch = useCallback(async (planCode: string) => {
    const api = apiClient(getToken, refreshSession);
    setLaunchingPlanCode(planCode);
    setError('');
    try {
      await startAppsInTossBillingLaunch({
        apiPost: api.post,
        runtime: hostRuntime,
        originUrl: window.location.origin + window.location.pathname,
        planCode
      });
    } catch (err) {
      if (err instanceof HostBridgeError) {
        if (err.code === 'payment_not_supported' || err.code === 'host_unavailable') {
          setError(copy.billing.planActionUnavailableNote);
        } else {
          setError(copy.billing.launchFailedNotice);
        }
      } else {
        setError(describeApiError(err, 'billing_launch'));
      }
    } finally {
      setLaunchingPlanCode('');
    }
  }, [copy.billing.launchFailedNotice, copy.billing.planActionUnavailableNote, getToken, hostRuntime, refreshSession]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-2xl font-bold tracking-tighter text-foreground">{t('common.appName')}</h1>
          <div className="flex items-center gap-2">
            <LanguagePicker />
            <Button variant="outline" size="sm" onClick={() => navigate('/session')}>
              {t('nav.sessions')}
            </Button>
          </div>
        </div>

        {hostNotice && (
          <StatusBanner tone={hostRuntime.platform === 'unknown' ? 'danger' : 'neutral'}>
            {hostNotice}
          </StatusBanner>
        )}
        {legacyNotice && (
          <StatusBanner>
            {legacyNotice}
          </StatusBanner>
        )}
        {error && (
          <StatusBanner tone="danger">
            {error}
          </StatusBanner>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>{copy.billing.currentPlanTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">{copy.billing.currentPlanDescription}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('billing.reload')}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : subscription ? (
              <div className="flex items-center gap-2">
                <Badge>{subscription.planCode}</Badge>
                <Badge variant="outline">{subscription.status}</Badge>
                {subscription.cancelAtPeriodEnd && (
                  <Badge variant="destructive">{t('billing.cancelsAtPeriodEnd')}</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('billing.noSubscription')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.billing.eyebrow}
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{copy.billing.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.billing.description}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {copy.billing.trustPoints.map(point => (
                <div key={point} className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground">
                  {point}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold tracking-tighter text-foreground">{copy.billing.plansTitle}</h2>
            <p className="text-sm text-muted-foreground">{copy.billing.plansDescription}</p>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('billing.loadingPlans')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 items-stretch sm:grid-cols-3">
              {plans.map(plan => {
                const isCurrent = subscription?.planCode === plan.code;
                return (
                  <Card
                    key={plan.code}
                    className={cn(
                      'flex flex-col transition-all',
                      isCurrent
                        ? 'border-primary border-2'
                        : 'border-border'
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">{plan.displayName}</CardTitle>
                        {isCurrent && (
                          <Badge className="bg-primary text-primary-foreground text-xs border-0">
                            {t('billing.currentPlan')}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <div className="text-3xl font-bold tracking-tighter text-foreground">
                        {plan.priceKrw > 0 ? `₩${plan.priceKrw.toLocaleString()}` : t('billing.free')}
                        {plan.priceKrw > 0 && (
                          <span className="text-sm font-normal text-muted-foreground">{t('billing.perMonth')}</span>
                        )}
                      </div>
                      <div className="flex-1 text-xs text-muted-foreground">
                        {t('billing.maxSession', { min: plan.maxSessionMinutes })}
                      </div>
                      <Button
                        className="mt-auto w-full"
                        size="sm"
                        variant={isCurrent ? 'secondary' : appsInTossAvailable ? 'default' : 'outline'}
                        disabled={isCurrent || !!launchingPlanCode || !appsInTossAvailable}
                        onClick={() => void handlePlanLaunch(plan.code)}
                      >
                        {isCurrent
                          ? t('billing.currentPlan')
                          : launchingPlanCode === plan.code
                            ? t('common.loading')
                            : copy.billing.planActionLabel}
                      </Button>
                      {!isCurrent && !appsInTossAvailable && (
                        <p className="text-xs text-muted-foreground">
                          {hostRuntime.platform === 'web'
                            ? copy.billing.planActionWebNote
                            : copy.billing.planActionUnavailableNote}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
