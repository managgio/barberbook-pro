import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Loader2, Repeat } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import { getActiveSubscriptionPlans, getMyActiveSubscription, getMySubscriptions, subscribeToPlan } from '@/data/api/subscriptions';
import { getStripeAvailability } from '@/data/api/payments';
import { SubscriptionCheckoutMode, SubscriptionPlan, UserSubscription } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';

const SubscriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t, language } = useI18n();
  const dateLocale = resolveDateLocale(language);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const subscriptionsEnabled = !tenant?.config?.adminSidebar?.hiddenSections?.includes('subscriptions');

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    setIsLoadingSubscriptions(true);

    const loadSubscriptions = async () => {
      const [plansResult, subscriptionsResult, activeSubscriptionResult, stripeResult] = await Promise.allSettled([
        getActiveSubscriptionPlans(),
        getMySubscriptions(),
        getMyActiveSubscription(),
        getStripeAvailability(),
      ]);
      if (!isMounted) return;

      setSubscriptionPlans(plansResult.status === 'fulfilled' ? plansResult.value : []);
      setUserSubscriptions(subscriptionsResult.status === 'fulfilled' ? subscriptionsResult.value : []);
      setActiveSubscription(activeSubscriptionResult.status === 'fulfilled' ? activeSubscriptionResult.value : null);
      setStripeEnabled(stripeResult.status === 'fulfilled' ? stripeResult.value?.enabled === true : false);
      setIsLoadingSubscriptions(false);
    };

    void loadSubscriptions();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const hasActiveSubscription = useMemo(() => Boolean(activeSubscription), [activeSubscription]);
  const paymentStatusLabel = useMemo(() => {
    if (!activeSubscription) return null;
    if (activeSubscription.paymentStatus === 'paid') return t('subscriptions.paymentStatus.paid');
    if (activeSubscription.paymentStatus === 'in_person') return t('subscriptions.paymentStatus.inPerson');
    if (activeSubscription.paymentStatus === 'pending') return t('subscriptions.paymentStatus.pendingStripe');
    if (activeSubscription.paymentStatus === 'failed') return t('subscriptions.paymentStatus.failed');
    if (activeSubscription.paymentStatus === 'cancelled') return t('subscriptions.paymentStatus.cancelled');
    if (activeSubscription.paymentStatus === 'exempt') return t('subscriptions.paymentStatus.exempt');
    return activeSubscription.paymentStatus;
  }, [activeSubscription, t]);

  const handleSubscribe = async (planId: string, paymentMode: SubscriptionCheckoutMode) => {
    if (subscribingPlanId || hasActiveSubscription) return;
    setSubscribingPlanId(planId);
    try {
      const response = await subscribeToPlan({ planId, paymentMode });
      if (response.mode === 'stripe' && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      const [subscriptions, active] = await Promise.all([getMySubscriptions(), getMyActiveSubscription()]);
      setUserSubscriptions(subscriptions);
      setActiveSubscription(active);
      toast({
        title: t('subscriptions.toast.activatedTitle'),
        description:
          paymentMode === 'stripe'
            ? t('subscriptions.toast.activatedStripe')
            : t('subscriptions.toast.activatedLocal'),
      });
    } catch (error) {
      toast({
        title: t('subscriptions.toast.activateErrorTitle'),
        description: error instanceof Error ? error.message : t('subscriptions.toast.genericError'),
        variant: 'destructive',
      });
    } finally {
      setSubscribingPlanId(null);
    }
  };

  useEffect(() => {
    const paymentResult = searchParams.get('subscriptionPayment');
    if (!paymentResult) return;
    if (paymentResult === 'success') {
      toast({
        title: t('subscriptions.toast.paymentSuccessTitle'),
        description: t('subscriptions.toast.paymentSuccessDescription'),
      });
    } else if (paymentResult === 'cancel') {
      toast({
        title: t('subscriptions.toast.paymentCancelTitle'),
        description: t('subscriptions.toast.paymentCancelDescription'),
      });
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('subscriptionPayment');
      next.delete('session_id');
      return next;
    });
  }, [searchParams, setSearchParams, t, toast]);

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {!subscriptionsEnabled && (
        <Card variant="elevated">
          <CardContent className="py-6 text-sm text-muted-foreground">
            {t('subscriptions.disabled')}
          </CardContent>
        </Card>
      )}
      {subscriptionsEnabled && (
        <>
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">{t('subscriptions.title')}</h1>
        <p className="text-xs sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
          {t('subscriptions.subtitle')}
        </p>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Repeat className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            {t('subscriptions.plans.title')}
          </CardTitle>
          <CardDescription className="hidden sm:block">
            {t('subscriptions.plans.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {isLoadingSubscriptions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('subscriptions.loading')}
            </div>
          ) : (
            <>
              {activeSubscription ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t('subscriptions.activePlan', { planName: activeSubscription.plan.name })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('subscriptions.validUntil', {
                          date: format(parseISO(activeSubscription.endDate), 'd MMM yyyy', { locale: dateLocale }),
                        })}
                      </p>
                      {paymentStatusLabel && (
                        <p className="text-xs text-muted-foreground">
                          {t('subscriptions.paymentStatusLabel')}
                          {' '}
                          <span className="font-medium text-foreground">{paymentStatusLabel}</span>
                        </p>
                      )}
                    </div>
                    <Badge>{t('subscriptions.status.active')}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('subscriptions.noActive')}</p>
              )}

              {subscriptionPlans.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('subscriptions.availablePlans')}
                  </p>
                  <div className="space-y-2">
                    {subscriptionPlans.map((plan) => {
                      const isCurrentPlan = activeSubscription?.planId === plan.id;
                      return (
                        <div
                          key={plan.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {plan.price.toFixed(2)}€ · {plan.durationValue}{' '}
                              {plan.durationUnit === 'days'
                                ? t('subscriptions.duration.days')
                                : plan.durationUnit === 'weeks'
                                  ? t('subscriptions.duration.weeks')
                                  : t('subscriptions.duration.months')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isCurrentPlan ? 'outline' : 'default'}
                              disabled={Boolean(subscribingPlanId) || isCurrentPlan || hasActiveSubscription}
                              onClick={() => void handleSubscribe(plan.id, 'next_appointment')}
                            >
                              {subscribingPlanId === plan.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              {isCurrentPlan
                                ? t('subscriptions.status.active')
                                : hasActiveSubscription
                                  ? t('subscriptions.unavailable')
                                  : t('subscriptions.payNextAppointment')}
                            </Button>
                            {stripeEnabled && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={Boolean(subscribingPlanId) || isCurrentPlan || hasActiveSubscription}
                                onClick={() => void handleSubscribe(plan.id, 'stripe')}
                              >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Stripe
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('subscriptions.noPlans')}</p>
              )}

              {userSubscriptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('subscriptions.history')}</p>
                  <div className="space-y-2">
                    {userSubscriptions.slice(0, 6).map((subscription) => (
                      <div
                        key={subscription.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{subscription.plan.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(subscription.startDate), 'd MMM yyyy', { locale: dateLocale })} -{' '}
                            {format(parseISO(subscription.endDate), 'd MMM yyyy', { locale: dateLocale })}
                          </p>
                        </div>
                        <Badge
                          variant={
                            subscription.status === 'active'
                              ? 'default'
                              : subscription.status === 'expired'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {subscription.status === 'active'
                            ? t('subscriptions.status.active')
                            : subscription.status === 'expired'
                              ? t('subscriptions.status.expired')
                              : t('subscriptions.status.cancelled')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
};

export default SubscriptionsPage;
