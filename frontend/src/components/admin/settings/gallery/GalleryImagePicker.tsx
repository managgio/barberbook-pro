import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/hooks/useI18n';
import { optimizeGalleryImage } from '@/lib/galleryImages';
import PhotoSourcePicker from '@/components/common/PhotoSourcePicker';

export type GalleryPhotoDraft = { url: string; fileId: string | null; blob?: Blob };
export default function GalleryImagePicker({ label, value, onChange, disabled, optional = false, onBusyChange }: {
  label: string; value: GalleryPhotoDraft | null; onChange: (photo: GalleryPhotoDraft | null) => void;
  disabled: boolean; optional?: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const mounted = useRef(true);
  const processing = useRef(false);
  const [preview, setPreview] = useState(value?.url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!value?.blob) { setPreview(value?.url ?? ''); return; }
    const url = URL.createObjectURL(value.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  const choose = async (file?: File) => {
    if (!file || processing.current) return;
    processing.current = true;
    setBusy(true); onBusyChange(true); setError(false);
    try {
      const blob = await optimizeGalleryImage(file);
      if (mounted.current) onChange({ blob, url: '', fileId: null });
    } catch { if (mounted.current) setError(true); }
    finally {
      processing.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };
  return <div className="min-w-0 space-y-2">
    <div className="flex min-h-7 items-center justify-between gap-2"><Label>{label}</Label>
      {optional && value && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={disabled || busy} aria-label={t('gallery.removeBefore')} onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>}
    </div>
    <PhotoSourcePicker label={t('gallery.chooseImage', { label })} disabled={disabled || busy} onFiles={(files) => void choose(files[0])}>
    <button type="button" disabled={disabled || busy} aria-label={t('gallery.chooseImage', { label })}
      className="group relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 text-muted-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
      {preview ? <><img src={preview} alt={label} className="h-full w-full object-cover" /><span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/70 px-2 py-2 text-xs font-medium text-white">{t('gallery.replaceImage')}</span></>
        : <span className="flex flex-col items-center gap-2 px-3 text-center text-xs"><ImagePlus className="h-7 w-7" />{t(optional ? 'gallery.optionalBefore' : 'gallery.selectImage')}</span>}
      {busy && <span role="status" className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">{t('gallery.optimizing')}</span></span>}
    </button></PhotoSourcePicker>
    {error && <p role="alert" className="text-xs text-destructive">{t('gallery.imageError')}</p>}
  </div>;
}
