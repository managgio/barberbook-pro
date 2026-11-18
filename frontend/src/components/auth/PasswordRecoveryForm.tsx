import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isRecoveryEmailValid, normalizeRecoveryEmail } from '@/lib/passwordRecovery';

type Props = { initialEmail: string; onBack: (email: string) => void };

const PasswordRecoveryForm = ({ initialEmail, onBack }: Props) => {
  const { forgotPassword } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    mounted.current = true;
    heading.current?.focus();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= retryAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || Date.now() < retryAt) return;
    const normalized = normalizeRecoveryEmail(email);
    if (!isRecoveryEmailValid(normalized)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }
    busy.current = true;
    setIsSending(true);
    setError('');
    try {
      const result = await forgotPassword(normalized);
      if (!mounted.current) return;
      if (result.success) {
        setEmail(normalized);
        setSentTo(normalized);
        setNow(Date.now());
        setRetryAt(Date.now() + 60_000);
        heading.current?.focus();
      } else {
        setError(result.error || t('auth.recovery.errors.generic'));
      }
    } catch {
      if (mounted.current) setError(t('auth.recovery.errors.generic'));
    } finally {
      busy.current = false;
      if (mounted.current) setIsSending(false);
    }
  };

  return (
    <section aria-labelledby="recovery-title" className="space-y-5">
      <div className="space-y-2">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {sentTo ? <CheckCircle2 aria-hidden="true" /> : <Mail aria-hidden="true" />}
        </div>
        <h2 id="recovery-title" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {sentTo ? t('auth.recovery.sentTitle') : t('auth.recovery.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('auth.recovery.description')}</p>
      </div>
      {sentTo && (
        <div role="status" className="space-y-3 rounded-lg border bg-card p-4 text-sm">
          <p className="break-words">{t('auth.recovery.sentDescription', { email: sentTo })}</p>
          <p className="text-muted-foreground">{t('auth.recovery.checkSpam')}</p>
        </div>
      )}
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={isSending}>
        <div className="space-y-2">
          <Label htmlFor="recovery-email">{t('auth.email')}</Label>
          <Input id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none"
            spellCheck={false} value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }}
            placeholder={t('auth.emailPlaceholder')} required maxLength={254} disabled={isSending}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'recovery-error' : undefined}
            className="h-12" />
        </div>
        {error && <Alert variant="destructive" id="recovery-error"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button type="submit" className="h-12 w-full" disabled={isSending || retrySeconds > 0}>
          {isSending && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {isSending ? t('auth.recovery.sending') : retrySeconds > 0
            ? t('auth.recovery.resendIn', { seconds: retrySeconds })
            : sentTo ? t('auth.recovery.resend') : t('auth.recovery.send')}
        </Button>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('auth.recovery.socialHelp')}</p>
      <Button variant="ghost" className="h-11 w-full" onClick={() => onBack(email)} disabled={isSending}>
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />{t('auth.recovery.backToLogin')}
      </Button>
    </section>
  );
};

export default PasswordRecoveryForm;
