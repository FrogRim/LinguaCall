import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UserSubscription, BillingPlan, BillingCheckoutSession } from '@lingua/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../components/ui/cn';
import { StatusBanner } from '../components/layout/SectionCard';
import { useUser } from '../context/UserContext';
import { apiClient, describeApiError } from '../lib/api';
import LanguagePicker from '../components/ui/LanguagePicker';
import { getFriendlyCopy } from '../content/friendlyCopy';
import { createCheckoutPayload, readBillingReturnState } from '../features/billing/checkout';
import { startTossCheckout } from '../features/billing/toss';

export default function ScreenBilling() {
  const { i18n, t } = useTranslation();
  const { getToken, refreshSession } = useUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const returnState = readBillingReturnState(window.location.href);
  const { checkoutResult, checkoutPlan, tossRedirect, shouldConfirm } = returnState;
  const copy = getFriendlyCopy(i18n.language);

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

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
    if (!checkoutResult) return;
    if (shouldConfirm) return;
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    next.delete('provider');
    next.delete('plan');
    const timeout = window.setTimeout(() => {
      setSearchParams(next, { replace: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [checkoutResult, searchParams, setSearchParams, shouldConfirm]);

  useEffect(() => {
    if (!shouldConfirm || !tossRedirect) return;

    let cancelled = false;
    const confirmReturn = async () => {
      const api = apiClient(getToken, refreshSession);
      setConfirmingReturn(true);
      setError('');
      try {
        await api.post<UserSubscription>('/billing/toss/confirm', tossRedirect);
        if (cancelled) return;
        setConfirmSuccess(true);
        await load();
      } catch (err) {
        if (cancelled) return;
        setConfirmSuccess(false);
        setError(describeApiError(err, 'billing_confirm'));
      } finally {
        if (!cancelled) {
          setConfirmingReturn(false);
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash.split('?')[0]}`);
          const next = new URLSearchParams(searchParams);
          next.delete('checkout');
          next.delete('provider');
          next.delete('plan');
          setSearchParams(next, { replace: true });
        }
      }
    };

    void confirmReturn();
    return () => {
      cancelled = true;
    };
  }, [getToken, load, refreshSession, searchParams, setSearchParams, shouldConfirm, tossRedirect]);

  const handleCheckout = async (planCode: string) => {
    const api = apiClient(getToken, refreshSession);
    setCheckoutLoading(planCode);
    try {
      const checkout = await api.post<BillingCheckoutSession>('/billing/checkout', createCheckoutPayload(window.location.href, planCode));
      await startTossCheckout(checkout);
    } catch (err) {
      setError(describeApiError(err, 'billing_checkout'));
    } finally {
      setCheckoutLoading(null);
    }
  };

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

        {confirmingReturn && (
          <StatusBanner>
            {t('common.confirming')}
          </StatusBanner>
        )}
        {!confirmingReturn && confirmSuccess && checkoutResult === 'success' && (
          <StatusBanner tone="success">
            {t('billing.checkoutSuccess', {
              plan: checkoutPlan ? t('billing.checkoutSuccessPlan', { plan: checkoutPlan }) : ''
            })}
          </StatusBanner>
        )}
        {!confirmingReturn && !shouldConfirm && checkoutResult === 'cancel' && (
          <StatusBanner>
            {t('billing.checkoutCancelled')}
          </StatusBanner>
        )}
        {error && (
          <StatusBanner tone="danger">
            {error}
          </StatusBanner>
        )}

        {/* Current Subscription */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>{t('billing.currentSubscription')}</CardTitle>
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

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold tracking-tighter text-foreground mb-4">{t('billing.availablePlans')}</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('billing.loadingPlans')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
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
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{plan.displayName}</CardTitle>
                        {isCurrent && (
                          <Badge className="bg-primary text-primary-foreground text-xs border-0">
                            {t('billing.currentPlan')}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 flex-1">
                      <div className="text-3xl font-bold tracking-tighter text-foreground">
                        {plan.priceKrw > 0 ? `₩${plan.priceKrw.toLocaleString()}` : t('billing.free')}
                        {plan.priceKrw > 0 && (
                          <span className="text-sm font-normal text-muted-foreground">{t('billing.perMonth')}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex-1">
                        {t('billing.maxSession', { min: plan.maxSessionMinutes })}
                      </div>
                      <Button
                        className="w-full mt-auto"
                        size="sm"
                        variant={isCurrent ? 'secondary' : 'default'}
                        onClick={() => void handleCheckout(plan.code)}
                        disabled={isCurrent || confirmingReturn || checkoutLoading === plan.code}
                      >
                        {checkoutLoading === plan.code || confirmingReturn
                          ? t('billing.processing')
                          : isCurrent
                          ? t('billing.currentPlan')
                          : t('billing.upgradeTo', { name: plan.displayName })}
                      </Button>
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
