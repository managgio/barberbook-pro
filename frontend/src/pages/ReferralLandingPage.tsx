import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resolveReferralCode, attributeReferral } from '@/data/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { storeReferralAttribution, getStoredReferralAttribution } from '@/lib/referrals';
import { Gift, UserPlus, ArrowRight } from 'lucide-react';

const ReferralLandingPage: React.FC = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [payload, setPayload] = useState<{
    referrerDisplayName: string;
    programEnabled: boolean;
    rewardSummary: { referrer: { text: string }; referred: { text: string } };
  } | null>(null);

  const stored = useMemo(() => getStoredReferralAttribution(), []);

  useEffect(() => {
    if (!code) return;
    let active = true;
    setIsLoading(true);
    resolveReferralCode(code)
      .then((data) => {
        if (!active) return;
        setPayload(data as any);
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
    if (payload && !payload.programEnabled) return;
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
          title: 'No se pudo registrar el referido',
          description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
      });
  }, [code, stored?.code, toast, user?.id, payload?.programEnabled]);

  useEffect(() => {
    if (!payload || !payload.programEnabled) return;
    const target = user ? '/app/book' : '/book';
    const timer = window.setTimeout(() => {
      navigate(target);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [navigate, payload, user]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-muted-foreground">
        Cargando invitación...
      </div>
    );
  }

  if (!payload || !payload.programEnabled) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-muted-foreground">
        Esta invitación no está disponible en este momento.
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
              Te invitó {payload.referrerDisplayName}
            </h1>
            <p className="text-muted-foreground">
              Reserva tu primera cita. Cuando la completes, desbloqueas tu recompensa.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tú ganas:</span>
              <span className="font-semibold text-foreground">{payload.rewardSummary.referred.text}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tu amigo gana:</span>
              <span className="font-semibold text-foreground">{payload.rewardSummary.referrer.text}</span>
            </div>
          </div>
          <Button
            size="lg"
            variant="glow"
            className="w-full"
            onClick={() => navigate(user ? '/app/book' : '/book')}
          >
            Reservar ahora
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <UserPlus className="w-4 h-4" />
            Redirigiendo al flujo de reserva...
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralLandingPage;
