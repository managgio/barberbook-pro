import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Loader2, Palette, RotateCcw, Type, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LandingAppearance from '@/components/landing/LandingAppearance';
import LandingSectionAccent from '@/components/landing/LandingSectionAccent';
import { useI18n } from '@/hooks/useI18n';
import { uploadToImageKit } from '@/lib/imagekit';
import { readHeadingFont, validSecondaryColor, type LandingAppearance as Appearance } from '@/lib/landingAppearance';
import { buildThemeTokens } from '@/lib/theme';

export default function BrandLandingAppearanceEditor({ brandId, subdomain, value, primary, mode, disabled, onChange, onBusyChange }: {
  brandId: string; subdomain: string; value: Appearance; primary?: string; mode: string; disabled: boolean;
  onChange: (updates: Appearance) => void; onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [colorDraft, setColorDraft] = useState(value.secondary ?? '');
  useEffect(() => { setColorDraft(value.secondary ?? ''); }, [value.secondary]);
  useEffect(() => () => { request.current?.abort(); request.current = null; onBusyChange(false); }, [onBusyChange]);

  const chooseFont = async (file?: File) => {
    if (!file || busy || disabled) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    setBusy(true); onBusyChange(true); setError('');
    let validated = false;
    try {
      const { format } = await readHeadingFont(file);
      validated = true;
      if (controller.signal.aborted) throw new Error('UPLOAD_ABORTED');
      const uploaded = await uploadToImageKit(file, `heading-${Date.now()}.${format}`, `website/${brandId}/brand/fonts`, {
        subdomainOverride: subdomain, signal: controller.signal,
      });
      if (controller.signal.aborted) throw new Error('UPLOAD_ABORTED');
      if (!uploaded.fileId || !uploaded.url?.startsWith('https://')) throw new Error('UPLOAD_INVALID');
      onChange({ headingFont: { ...uploaded, format, name: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Font' } });
    } catch {
      if (request.current === controller) setError(t(validated ? 'platform.appearance.uploadError' : 'platform.appearance.fontInvalid'));
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { setBusy(false); onBusyChange(false); }
    }
  };
  const light = mode === 'light';
  const previewStyle = {
    ...buildThemeTokens(primary || '#fcbc23'),
    '--background': light ? '0 0% 100%' : '0 0% 4%', '--card': light ? '0 0% 98%' : '0 0% 7%',
    '--foreground': light ? '0 0% 10%' : '0 0% 98%', '--muted-foreground': light ? '0 0% 40%' : '0 0% 65%',
    '--border': light ? '0 0% 85%' : '0 0% 20%',
  } as CSSProperties;

  return <section className="space-y-4 border-t border-border/60 pt-5" aria-labelledby={`${id}-title`}>
    <div><h3 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold"><Palette className="h-4 w-4 text-primary" />{t('platform.appearance.title')}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('platform.appearance.description')}</p></div>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5">
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <Label htmlFor={`${id}-color`}>{t('platform.appearance.secondary')}</Label>
          <div className="flex gap-2">
            <Input type="color" aria-label={t('platform.appearance.chooseColor')} disabled={disabled || busy} className="h-10 w-14 shrink-0 p-1"
              value={validSecondaryColor(value.secondary) ? value.secondary : '#80604a'} onChange={event => onChange({ secondary: event.target.value })} />
            <Input id={`${id}-color`} value={colorDraft} placeholder={t('platform.appearance.noSecondary')} maxLength={7} disabled={disabled || busy}
              aria-invalid={Boolean(colorDraft && !validSecondaryColor(colorDraft))} onChange={event => {
                const text = event.target.value; setColorDraft(text);
                if (!text || validSecondaryColor(text)) onChange({ secondary: text || null });
              }} onBlur={() => setColorDraft(value.secondary ?? '')} />
            <Button type="button" size="icon" variant="ghost" disabled={disabled || busy || !value.secondary} aria-label={t('platform.appearance.resetColor')}
              onClick={() => { setColorDraft(''); onChange({ secondary: null }); }}><RotateCcw className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('platform.appearance.secondaryHint')}</p>
        </div>
        <div className="space-y-2">
          <Label>{t('platform.appearance.font')}</Label>
          <div className="rounded-xl border border-border/60 p-3">
            <div className="flex min-w-0 items-center gap-2"><Type className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 truncate text-sm font-medium">{value.headingFont?.name || t('platform.appearance.defaultFont')}</span></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={picker} type="file" accept=".ttf,.otf,.woff,.woff2" aria-label={t('platform.appearance.uploadFont')} className="sr-only" tabIndex={-1} disabled={disabled || busy}
                onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void chooseFont(file); }} />
              <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => picker.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{t(busy ? 'platform.appearance.uploading' : 'platform.appearance.uploadFont')}
              </Button>
              {value.headingFont && <Button type="button" size="sm" variant="ghost" disabled={disabled || busy} onClick={() => { onChange({ headingFont: null }); setError(''); }}><RotateCcw className="h-4 w-4" />{t('platform.appearance.resetFont')}</Button>}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('platform.appearance.fontHint')}</p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-muted-foreground">{t('platform.appearance.preview')}</p>
        <div style={previewStyle} className="overflow-hidden rounded-xl border border-border/60">
          <LandingAppearance appearance={value} mode={mode} className="space-y-4 bg-background p-5 text-foreground sm:p-6">
            <LandingSectionAccent />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{t('platform.appearance.previewEyebrow')}</p>
            <h4 className="landing-heading text-2xl font-bold leading-tight">{t('platform.appearance.previewHeading')}</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('platform.appearance.previewBody')}</p>
            <Card className="landing-detail-card border-primary/15 p-3">
              <p className="landing-heading text-base font-semibold">{t('platform.appearance.previewCard')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('platform.appearance.previewCardBody')}</p>
            </Card>
            <Button variant="hero" size="sm" className="h-9 px-3 py-2 text-xs" asChild>
              <span>{t('platform.appearance.previewButton')}</span>
            </Button>
          </LandingAppearance>
        </div>
        <p className="text-xs text-muted-foreground">{t('platform.appearance.saveHint')}</p>
      </div>
    </div>
  </section>;
}
