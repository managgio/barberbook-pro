import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resolveReferralCode, attributeReferral } from '@/data/api/referrals';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { storeReferralAttribution, getStoredReferralAttribution } from '@/lib/referrals';
import { Gift, UserPlus, ArrowRight } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

type ReferralLandingPayload = Awaited<ReturnType<typeof resolveReferralCode>>;

const ReferralLandingPage: React.FC = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [payload, setPayload] = useState<ReferralLandingPayload | null>(null);

  const stored = useMemo(() => getStoredReferralAttribution(), []);

  useEffect(() => {
    if (!code) return;
    let active = true;
    setIsLoading(true);
    resolveReferralCode(code)
      .then((data) => {
        if (!active) return;
        setPayload(data);
      })
      .catch(() => {
        if (!active) return;
        setPayload(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    if (stored?.code === code) return;
    if (payload?.programEnabled === false) return;
    attributeReferral({
      code,
      channel: 'link',
      ...(user?.id ? { userId: user.id } : {}),
    })
      .then((data) => {
        storeReferralAttribution({ id: data.attributionId, expiresAt: data.expiresAt, code });
      })
      .catch((error) => {
        toast({
          title: t('referralLanding.toast.attributeErrorTitle'),
          description: error instanceof Error ? error.message : t('referralLanding.toast.attributeErrorDescription'),
          variant: 'destructive',
        });
      });
  }, [code, stored?.code, toast, user?.id, payload?.programEnabled, t]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-muted-foreground">
        {t('referralLanding.loading')}
      </div>
    );
  }

  if (!payload || !payload.programEnabled) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-muted-foreground">
        {t('referralLanding.unavailable')}
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Card variant="elevated" className="max-w-xl w-full">
        <CardContent className="p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {t('referralLanding.title', { name: payload.referrerDisplayName })}
            </h1>
            <p className="text-muted-foreground">
              {t('referralLanding.subtitle')}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('referralLanding.youWin')}</span>
              <span className="font-semibold text-foreground">{payload.rewardSummary.referred.text}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('referralLanding.friendWins')}</span>
              <span className="font-semibold text-foreground">{payload.rewardSummary.referrer.text}</span>
            </div>
          </div>
          {user ? (
            <Button
              size="lg"
              variant="glow"
              className="w-full"
              onClick={() => navigate('/app/book')}
            >
              {t('referralLanding.actions.bookNow')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                {t('referralLanding.signUpHint')}
              </div>
              <Button
                size="lg"
                variant="glow"
                className="w-full"
                onClick={() => navigate('/auth?tab=signup&redirect=/app/book')}
              >
                {t('referralLanding.actions.signUpAndBook')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/auth?redirect=/app/book')}
              >
                {t('referralLanding.actions.alreadyHaveAccount')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralLandingPage;
