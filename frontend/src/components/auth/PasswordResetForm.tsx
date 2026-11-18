import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Props = { code: string; onLogin: () => void | Promise<void>; onRequestLink: () => void; onConsumed: () => void };
type Status = 'checking' | 'ready' | 'invalid' | 'verification-error' | 'complete';

const PasswordResetForm = ({ code, onLogin, onRequestLink, onConsumed }: Props) => {
  const { inspectPasswordReset, resetPassword } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const consumed = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (consumed.current) return;
    let active = true;
    setStatus('checking');
    setError('');
    void (async () => {
      try {
        const result = await inspectPasswordReset(code);
        if (!active) return;
        setStatus(result.success ? 'ready' : result.invalidLink ? 'invalid' : 'verification-error');
        setError(result.error || '');
      } catch {
        if (active) { setStatus('verification-error'); setError(t('auth.recovery.errors.generic')); }
      }
    })();
    return () => { active = false; };
  }, [code, attempt, inspectPasswordReset, t]);

  useEffect(() => { heading.current?.focus(); }, [status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || status !== 'ready') return;
    if (!password) { setError(t('auth.recovery.errors.passwordRequired')); return; }
    if (password !== confirmation) { setError(t('auth.recovery.errors.passwordMismatch')); return; }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await resetPassword(code, password);
      if (!mounted.current) return;
      if (result.success) {
        consumed.current = true;
        setPassword('');
        setConfirmation('');
        setStatus('complete');
        onConsumed();
      } else {
        setError(result.error || t('auth.recovery.errors.generic'));
        if (result.invalidLink) setStatus('invalid');
      }
    } catch {
      if (mounted.current) setError(t('auth.recovery.errors.generic'));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const goToLogin = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try { await onLogin(); }
    catch { if (mounted.current) setError(t('auth.recovery.errors.signOut')); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };

  return (
    <section aria-labelledby="reset-title" className="space-y-5">
      <div className="space-y-2">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {status === 'complete' ? <CheckCircle2 aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
        </div>
        <h2 id="reset-title" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {status === 'complete' ? t('auth.recovery.completeTitle') : t('auth.recovery.resetTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{status === 'complete'
          ? t('auth.recovery.completeDescription') : t('auth.recovery.resetDescription')}</p>
      </div>
      {status === 'checking' && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{t('auth.recovery.checking')}
      </p>}
      {error && <Alert variant="destructive" id="reset-error"><AlertDescription>{error}</AlertDescription></Alert>}
      {status === 'ready' && <form onSubmit={submit} noValidate className="space-y-4" aria-busy={saving}>
        <div className="space-y-2">
          <Label htmlFor="new-password">{t('auth.recovery.newPassword')}</Label>
          <Input id="new-password" name="new-password" type={visible ? 'text' : 'password'} autoComplete="new-password"
            value={password} onChange={(event) => setPassword(event.target.value)} disabled={saving} required
            aria-describedby={error ? 'reset-error' : undefined} aria-invalid={Boolean(error)} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t('auth.recovery.confirmPassword')}</Label>
          <Input id="confirm-password" name="confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password"
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={saving} required
            aria-describedby={error ? 'reset-error' : undefined} aria-invalid={Boolean(error)} className="h-12" />
        </div>
        <Button type="button" variant="ghost" aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={saving}>
          {visible ? <EyeOff aria-hidden="true" className="mr-2 h-4 w-4" /> : <Eye aria-hidden="true" className="mr-2 h-4 w-4" />}
          {visible ? t('auth.recovery.hidePasswords') : t('auth.recovery.showPasswords')}
        </Button>
        <Button type="submit" className="h-12 w-full" disabled={saving}>
          {saving && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {saving ? t('auth.recovery.saving') : t('auth.recovery.savePassword')}
        </Button>
      </form>}
      {status === 'verification-error' && <Button className="h-12 w-full" onClick={() => setAttempt(attempt + 1)}>{t('auth.recovery.retry')}</Button>}
      {status === 'invalid' && <Button className="h-12 w-full" onClick={onRequestLink}>{t('auth.recovery.requestNewLink')}</Button>}
      {status !== 'checking' && <Button variant={status === 'complete' ? 'default' : 'ghost'} className="h-12 w-full"
        onClick={() => void goToLogin()} disabled={saving}>{t('auth.recovery.backToLogin')}</Button>}
    </section>
  );
};

export default PasswordResetForm;
