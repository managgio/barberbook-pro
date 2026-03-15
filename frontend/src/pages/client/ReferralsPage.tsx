import React, { useEffect, useMemo, useState } from 'react';
import type { Locale } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getReferralSummary, getRewardsWallet } from '@/data/api/referrals';
import { ReferralSummaryResponse, RewardWalletSummary, ReferralAttributionItem } from '@/data/types';
import { Copy, Share2, QrCode, Gift, Wallet, Ticket } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useBusinessCopy } from '@/lib/businessCopy';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';

const buildWhatsAppMessage = (template: string, link: string) => template.replace('{link}', link);

const ReferralStatusCard: React.FC<{
  item: ReferralAttributionItem;
  t: (key: string, values?: Record<string, string | number>) => string;
  dateLocale: Locale;
}> = ({ item, t, dateLocale }) => {
  const referredName = item.referred?.name || item.referred?.email || item.referred?.phone || t('referrals.invitedFallback');
  const statusLabel =
    item.status === 'REWARDED' || item.status === 'COMPLETED'
      ? t('referrals.status.confirmed')
      : item.status === 'EXPIRED'
      ? t('referrals.status.expired')
      : item.status === 'VOIDED'
      ? t('referrals.status.invalidated')
      : t('referrals.status.pending');
  const description =
    item.status === 'REWARDED' || item.status === 'COMPLETED'
      ? t('referrals.statusDescription.confirmed')
      : item.status === 'EXPIRED'
      ? t('referrals.statusDescription.expired')
      : item.status === 'VOIDED'
      ? t('referrals.statusDescription.invalidated')
      : t('referrals.statusDescription.pending');

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4 space-y-1.5 sm:space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm sm:text-base font-semibold text-foreground truncate">{referredName}</p>
        <span className="text-xs font-medium uppercase text-muted-foreground">{statusLabel}</span>
      </div>
      <p className="hidden sm:block text-xs text-muted-foreground">{description}</p>
      <p className="text-[10px] sm:text-[11px] text-muted-foreground">
        {format(parseISO(item.attributedAt), 'd MMM yyyy', { locale: dateLocale })}
      </p>
    </div>
  );
};

const ReferralsPage: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const dateLocale = resolveDateLocale(language);
  const [summary, setSummary] = useState<ReferralSummaryResponse | null>(null);
  const [walletSummary, setWalletSummary] = useState<RewardWalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const walletAvailable = walletSummary?.wallet.availableBalance ?? 0;
  const walletBalance = walletSummary?.wallet.balance ?? 0;

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setIsLoading(true);
    Promise.all([getReferralSummary(user.id), getRewardsWallet(user.id)])
      .then(([summaryData, walletData]) => {
        if (!active) return;
        setSummary(summaryData);
        setWalletSummary(walletData);
      })
      .catch(() => {
        if (!active) return;
        setSummary(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const shareUrl = useMemo(() => {
    if (!summary?.code) return '';
    if (summary.shareUrl) return summary.shareUrl;
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/ref/${summary.code}`;
  }, [summary?.code, summary?.shareUrl]);

  const qrPayload = summary?.qrUrlPayload || shareUrl;
  const qrUrl = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(qrPayload)}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast({
      title: t('referrals.toast.linkCopiedTitle'),
      description: t('referrals.toast.linkCopiedDescription'),
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('referrals.loading')}</div>;
  }

  if (!summary) {
    return <div className="text-sm text-muted-foreground">{t('referrals.loadError')}</div>;
  }
  if (summary.programEnabled === false) {
    return (
      <div className="text-sm text-muted-foreground">
        {summary.blockedBySubscription
          ? t('referrals.blockedBySubscription')
          : t('referrals.disabledInLocation', { location: copy.location.definiteSingular })}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">{t('referrals.title')}</h1>
        <p className="text-xs sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
          {t('referrals.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t('referrals.share.title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('referrals.share.description', { location: copy.location.definiteSingular })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input value={shareUrl} readOnly className="h-9 sm:h-10 text-xs sm:text-sm" />
              <Button variant="outline" onClick={handleCopy} className="h-9 sm:h-10 text-xs sm:text-sm gap-2">
                <Copy className="w-4 h-4" />
                {t('referrals.share.copyLink')}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="glow"
                className="h-9 sm:h-10 text-xs sm:text-sm gap-2"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(
                      buildWhatsAppMessage(t('referrals.share.whatsappMessage'), shareUrl),
                    )}`,
                  )
                }
              >
                {t('referrals.share.whatsapp')}
              </Button>
            </div>
            {qrUrl && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-4 flex flex-col items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <QrCode className="w-4 h-4" />
                  {t('referrals.share.qrHint')}
                </div>
                <img
                  src={qrUrl}
                  alt={t('referrals.share.qrAlt')}
                  loading="lazy"
                  decoding="async"
                  width={160}
                  height={160}
                  className="w-28 h-28 sm:w-40 sm:h-40"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t('referrals.rewardsSummary.title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('referrals.rewardsSummary.youWin', { reward: summary.rewardSummary.referrer.text })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 sm:space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">{t('referrals.rewardsSummary.youWinLabel')}</p>
              <p className="text-sm sm:text-lg font-semibold text-foreground">{summary.rewardSummary.referrer.text}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">{t('referrals.rewardsSummary.friendWinsLabel')}</p>
              <p className="text-sm sm:text-lg font-semibold text-foreground">{summary.rewardSummary.referred.text}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            {t('referrals.wallet.title')}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('referrals.wallet.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 sm:px-4 py-2.5 sm:py-3">
            <div>
              <p className="text-xs text-muted-foreground">{t('referrals.wallet.availableBalance')}</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{walletAvailable.toFixed(2)}€</p>
            </div>
            <span className="text-[11px] sm:text-xs text-muted-foreground">
              {t('referrals.wallet.totalBalance', { amount: walletBalance.toFixed(2) })}
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
              <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('referrals.wallet.activeCoupons')}
            </p>
            {walletSummary?.coupons.length ? (
              <div className="grid gap-2">
                {walletSummary.coupons.map((coupon) => (
                  <div key={coupon.id} className="rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:p-3 text-xs sm:text-sm">
                    {coupon.discountType === 'FREE_SERVICE'
                      ? t('referrals.coupon.freeService')
                      : coupon.discountType === 'PERCENT_DISCOUNT'
                      ? t('referrals.coupon.percentDiscount', { value: coupon.discountValue ?? 0 })
                      : t('referrals.coupon.fixedDiscount', { value: coupon.discountValue ?? 0 })}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('referrals.wallet.noActiveCoupons')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3 h-7 sm:h-10 p-0.5 sm:p-1">
          <TabsTrigger value="pending" className="h-full px-1 sm:px-3 py-0 text-[10px] sm:text-sm leading-none">{t('referrals.tabs.pending')}</TabsTrigger>
          <TabsTrigger value="confirmed" className="h-full px-1 sm:px-3 py-0 text-[10px] sm:text-sm leading-none">{t('referrals.tabs.confirmed')}</TabsTrigger>
          <TabsTrigger value="rewards" className="h-full px-1 sm:px-3 py-0 text-[10px] sm:text-sm leading-none">{t('referrals.tabs.rewards')}</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {summary.pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('referrals.empty.pending')}</p>
          ) : (
            summary.pending.map((item) => (
              <ReferralStatusCard key={item.id} item={item} t={t} dateLocale={dateLocale} />
            ))
          )}
        </TabsContent>
        <TabsContent value="confirmed" className="space-y-3">
          {summary.confirmed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('referrals.empty.confirmed')}</p>
          ) : (
            summary.confirmed.map((item) => (
              <ReferralStatusCard key={item.id} item={item} t={t} dateLocale={dateLocale} />
            ))
          )}
        </TabsContent>
        <TabsContent value="rewards" className="space-y-3">
          {summary.expired.length === 0 && summary.invalidated.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('referrals.empty.rewards')}</p>
          ) : (
            <div className="space-y-3">
              {summary.expired.map((item) => (
                <ReferralStatusCard key={item.id} item={item} t={t} dateLocale={dateLocale} />
              ))}
              {summary.invalidated.map((item) => (
                <ReferralStatusCard key={item.id} item={item} t={t} dateLocale={dateLocale} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReferralsPage;
