import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getReferralSummary, getRewardsWallet } from '@/data/api';
import { ReferralSummaryResponse, RewardWalletSummary, ReferralAttributionItem } from '@/data/types';
import { Copy, Share2, QrCode, Gift, Wallet, Ticket } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const buildWhatsAppMessage = (link: string) =>
  `Invita a alguien de confianza. Cuando complete su primera visita, ambos ganáis. ${link}`;

const ReferralStatusCard: React.FC<{ item: ReferralAttributionItem }> = ({ item }) => {
  const referredName = item.referred?.name || item.referred?.email || item.referred?.phone || 'Invitado';
  const statusLabel =
    item.status === 'REWARDED' || item.status === 'COMPLETED'
      ? 'Confirmado'
      : item.status === 'EXPIRED'
      ? 'Expirado'
      : item.status === 'VOIDED'
      ? 'Invalidado'
      : 'Pendiente';
  const description =
    item.status === 'REWARDED' || item.status === 'COMPLETED'
      ? '¡Listo! Tu recompensa está disponible.'
      : item.status === 'EXPIRED'
      ? 'La invitación caducó antes de completar la primera visita.'
      : item.status === 'VOIDED'
      ? 'Esta invitación fue invalidada por seguridad.'
      : 'Tu invitación está activa. Se desbloquea cuando complete su primera visita.';

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">{referredName}</p>
        <span className="text-xs font-medium uppercase text-muted-foreground">{statusLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <p className="text-[11px] text-muted-foreground">
        {format(parseISO(item.attributedAt), 'd MMM yyyy', { locale: es })}
      </p>
    </div>
  );
};

const ReferralsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
      title: 'Enlace copiado',
      description: 'Ya puedes compartir tu enlace de referido.',
    });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Cargando tu programa de referidos...</div>;
  }

  if (!summary) {
    return <div className="text-muted-foreground">No pudimos cargar el programa de referidos.</div>;
  }
  if (summary.programEnabled === false) {
    return <div className="text-muted-foreground">El programa de referidos no está activo en este local.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Invita y gana</h1>
        <p className="text-muted-foreground mt-1">
          Invita a alguien de confianza. Cuando complete su primera visita, ambos ganáis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Comparte tu invitación
            </CardTitle>
            <CardDescription>
              Comparte tu enlace o muestra el QR en el local.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input value={shareUrl} readOnly />
              <Button variant="outline" onClick={handleCopy} className="gap-2">
                <Copy className="w-4 h-4" />
                Copiar enlace
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="glow"
                className="gap-2"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(shareUrl))}`)}
              >
                Compartir por WhatsApp
              </Button>
            </div>
            {qrUrl && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <QrCode className="w-4 h-4" />
                  Escanea este QR para reservar con tu recompensa.
                </div>
                <img src={qrUrl} alt="QR de referido" className="w-40 h-40" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Resumen de recompensas
            </CardTitle>
            <CardDescription>
              Tú ganas: {summary.rewardSummary.referrer.text}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Tú ganas:</p>
              <p className="text-lg font-semibold text-foreground">{summary.rewardSummary.referrer.text}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Tu amigo gana:</p>
              <p className="text-lg font-semibold text-foreground">{summary.rewardSummary.referred.text}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Recompensas disponibles
          </CardTitle>
          <CardDescription>
            Saldo disponible y cupones activos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Saldo disponible</p>
              <p className="text-xl font-bold text-foreground">{walletAvailable.toFixed(2)}€</p>
            </div>
            <span className="text-xs text-muted-foreground">Saldo total: {walletBalance.toFixed(2)}€</span>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Cupones activos
            </p>
            {walletSummary?.coupons.length ? (
              <div className="grid gap-2">
                {walletSummary.coupons.map((coupon) => (
                  <div key={coupon.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                    {coupon.discountType === 'FREE_SERVICE'
                      ? 'Servicio gratis'
                      : coupon.discountType === 'PERCENT_DISCOUNT'
                      ? `${coupon.discountValue ?? 0}% de descuento`
                      : `${coupon.discountValue ?? 0}€ de descuento`}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No tienes cupones activos ahora mismo.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmados</TabsTrigger>
          <TabsTrigger value="rewards">Recompensas</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {summary.pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes invitaciones pendientes.</p>
          ) : (
            summary.pending.map((item) => <ReferralStatusCard key={item.id} item={item} />)
          )}
        </TabsContent>
        <TabsContent value="confirmed" className="space-y-3">
          {summary.confirmed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes referidos confirmados.</p>
          ) : (
            summary.confirmed.map((item) => <ReferralStatusCard key={item.id} item={item} />)
          )}
        </TabsContent>
        <TabsContent value="rewards" className="space-y-3">
          {summary.expired.length === 0 && summary.invalidated.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay invitaciones expiradas o invalidadas.</p>
          ) : (
            <div className="space-y-3">
              {summary.expired.map((item) => (
                <ReferralStatusCard key={item.id} item={item} />
              ))}
              {summary.invalidated.map((item) => (
                <ReferralStatusCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReferralsPage;
