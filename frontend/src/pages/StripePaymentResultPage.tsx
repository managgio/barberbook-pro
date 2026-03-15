import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getStripeSession } from '@/data/api/payments';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';

const StripePaymentResultPage: React.FC = () => {
  const { status } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const sessionId = searchParams.get('session_id');
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setIsLoading(true);
    getStripeSession(sessionId)
      .then((data) => {
        if (!active) return;
        setSessionStatus(data?.status || null);
      })
      .catch(() => {
        if (!active) return;
        setSessionStatus(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const isSuccess = status === 'success';
  const title = isSuccess ? t('stripePaymentResult.title.success') : t('stripePaymentResult.title.cancelled');
  const description = isSuccess
    ? sessionStatus === 'complete'
      ? t('stripePaymentResult.description.successConfirmed')
      : t('stripePaymentResult.description.successPending')
    : t('stripePaymentResult.description.cancelled');

  const buttonLabel = user ? t('stripePaymentResult.actions.viewAppointments') : t('stripePaymentResult.actions.backHome');
  const buttonHref = user ? '/app/appointments' : '/';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card variant="elevated" className="max-w-lg w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className={`mx-auto h-14 w-14 rounded-full flex items-center justify-center ${isSuccess ? 'bg-primary/10' : 'bg-destructive/10'}`}>
            {isSuccess ? (
              <CheckCircle className="h-8 w-8 text-primary" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" />
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('stripePaymentResult.loading')}
            </div>
          )}
          <Button asChild className="w-full" variant={isSuccess ? 'glow' : 'outline'}>
            <Link to={buttonHref}>{buttonLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StripePaymentResultPage;
