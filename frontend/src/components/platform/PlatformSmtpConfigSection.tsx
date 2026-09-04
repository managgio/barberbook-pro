import { Loader2, PlugZap } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { verifyPlatformBrandEmailConfig } from '@/data/api/platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';

export type PlatformEmailConfig = Record<string, unknown> & {
  user?: string;
  password?: string;
  passwordConfigured?: boolean;
  host?: string;
  port?: string | number;
  fromName?: string;
};

type PlatformSmtpConfigSectionProps = {
  brandId: string;
  config?: PlatformEmailConfig;
  onChange: (field: keyof PlatformEmailConfig, value: string) => void;
};

export default function PlatformSmtpConfigSection({
  brandId,
  config = {},
  onChange,
}: PlatformSmtpConfigSectionProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const verifyMutation = useMutation({
    mutationFn: () => verifyPlatformBrandEmailConfig(brandId, {
      user: config.user || '',
      password: config.password || '',
      host: config.host || '',
      port: config.port || '',
    }),
    onSuccess: (result) => {
      toast({
        title: result.ok
          ? t('platform.smtp.verification.successTitle')
          : t('platform.smtp.verification.errorTitle'),
        description: result.ok
          ? t('platform.smtp.verification.successDescription', {
              host: result.endpoint?.host,
              port: result.endpoint?.port,
            })
          : `${result.code}: ${result.message}`,
        variant: result.ok ? 'default' : 'destructive',
      });
    },
    onError: () => {
      toast({
        title: t('platform.smtp.verification.errorTitle'),
        description: t('platform.smtp.verification.requestError'),
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {t('platform.smtp.title')}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platform-smtp-user">{t('platform.smtp.user')}</Label>
          <Input
            id="platform-smtp-user"
            inputMode="email"
            autoComplete="username"
            placeholder="cuenta@outlook.com o cuenta@gmail.com"
            value={config.user || ''}
            onChange={(event) => onChange('user', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform-smtp-password">{t('platform.smtp.password')}</Label>
          <Input
            id="platform-smtp-password"
            type="password"
            autoComplete="new-password"
            value={config.password || ''}
            placeholder={config.passwordConfigured
              ? t('platform.smtp.passwordConfigured')
              : t('platform.smtp.passwordPlaceholder')}
            onChange={(event) => onChange('password', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform-smtp-host">{t('platform.smtp.host')}</Label>
          <Input
            id="platform-smtp-host"
            value={config.host || ''}
            onChange={(event) => onChange('host', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform-smtp-port">{t('platform.smtp.port')}</Label>
          <Input
            id="platform-smtp-port"
            inputMode="numeric"
            value={config.port || ''}
            onChange={(event) => onChange('port', event.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="platform-smtp-from-name">{t('platform.smtp.fromName')}</Label>
          <Input
            id="platform-smtp-from-name"
            value={config.fromName || ''}
            onChange={(event) => onChange('fromName', event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs text-muted-foreground">
          {t('platform.smtp.help')}
        </p>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          {verifyMutation.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            : <PlugZap className="mr-2 h-4 w-4" aria-hidden="true" />}
          {t('platform.smtp.verify')}
        </Button>
      </div>
    </div>
  );
}
