import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import { discardWebsiteUpload, WebsiteImage, WebsiteImageSection, WebsiteImageSelection } from '@/data/api/website';
import { galleryImageExtension, optimizeGalleryImage } from '@/lib/galleryImages';
import { uploadToImageKit } from '@/lib/imagekit';
import WebsitePhotoGuidance from './WebsitePhotoGuidance';
import WebsitePhotoGrid, { WebsitePhotoDraft } from './WebsitePhotoGrid';
import usePhotoGridDrag from './usePhotoGridDrag';
import { moveOrderedItem } from '@/hooks/useOrderedListDrag';

export default function WebsiteImageEditor({ section, title, brandId, localId, onClose, onSave }: {
  section: WebsiteImageSection; title: string; brandId: string; localId: string; onClose: () => void;
  onSave: (images: WebsiteImageSelection[]) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [photos, setPhotos] = useState<WebsitePhotoDraft[]>(() => section.images.map((image) => ({ ...image, key: crypto.randomUUID() })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const objectUrls = useRef(new Set<string>());
  const uploaded = useRef(new Map<string, WebsiteImage>());
  const retained = useRef(new Set<string>());
  const sorter = usePhotoGridDrag(photos.map((photo) => photo.key), busy, (from, to) => setPhotos((current) => moveOrderedItem(current, from, to)));
  const disabled = busy || Boolean(sorter.drag);
  useEffect(() => {
    mounted.current = true;
    const urls = objectUrls.current, uploads = uploaded.current, kept = retained.current;
    return () => {
      mounted.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      uploads.forEach((image) => { if (!kept.has(image.fileId)) void discardWebsiteUpload(localId, image.fileId).catch(() => undefined); });
    };
  }, [localId]);
  const receive = async (files: FileList, index: number | null) => {
    if (!files?.length || pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      const capacity = index === null ? section.limit - photos.length : 1;
      if (files.length > capacity) throw new Error('LIMIT');
      const prepared: WebsitePhotoDraft[] = [];
      for (const file of Array.from(files)) {
        const blob = await optimizeGalleryImage(file);
        if (!mounted.current) return;
        const url = URL.createObjectURL(blob); objectUrls.current.add(url);
        prepared.push({ key: crypto.randomUUID(), url, fileId: '', blob });
      }
      setPhotos((current) => index === null ? [...current, ...prepared] : current.map((photo, i) => i === index ? prepared[0] : photo));
    } catch { if (mounted.current) setError(true); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const save = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false); setProgress(0);
    try {
      const selection: WebsiteImageSelection[] = [];
      for (const [index, photo] of photos.entries()) {
        let image = uploaded.current.get(photo.key) ?? photo;
        if (photo.blob && !uploaded.current.has(photo.key)) {
          image = await uploadToImageKit(photo.blob, `website-${crypto.randomUUID()}.${galleryImageExtension(photo.blob)}`, `website/${brandId}/${localId}`, { localIdOverride: localId, signal: AbortSignal.timeout(90_000) });
          uploaded.current.set(photo.key, image);
          if (!mounted.current) { void discardWebsiteUpload(localId, image.fileId).catch(() => undefined); return; }
        }
        selection.push(image.fileId ? { fileId: image.fileId } : { existingUrl: image.url });
        setProgress(index + 1);
      }
      // Mark retained before saving: a successful save can unmount the dialog synchronously.
      selection.forEach((image) => { if (image.fileId) retained.current.add(image.fileId); });
      const saved = await onSave(selection);
      if (!saved) {
        retained.current.clear();
        if (!mounted.current) uploaded.current.forEach((image) => { void discardWebsiteUpload(localId, image.fileId).catch(() => undefined); });
      }
    } catch {
      retained.current.clear();
      if (mounted.current) setError(true);
      else uploaded.current.forEach((image) => { void discardWebsiteUpload(localId, image.fileId).catch(() => undefined); });
    }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !disabled) onClose(); }}>
    <DialogContent className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
      onEscapeKeyDown={(event) => { if (sorter.cancel()) event.preventDefault(); }} onInteractOutside={(event) => { if (disabled) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{t(`website.hint.${section.kind}`)}</DialogDescription></DialogHeader>
      <div ref={sorter.scrollRef} className="min-h-0 overflow-y-auto overscroll-contain pr-1">
        <WebsitePhotoGuidance kind={section.kind} />
        <WebsitePhotoGrid photos={photos} limit={section.limit} busy={busy} sorter={sorter} onSelect={(files, index) => void receive(files, index)} onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))} />
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('website.formatHint', { limit: section.limit })}</p>
        {photos.length < section.images.length && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">{t('website.removalHint')}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{t('website.imageError')}</p>}
      </div>
      <DialogFooter className="gap-2 border-t pt-4"><Button variant="outline" disabled={disabled} onClick={onClose}>{t('admin.faq.cancel')}</Button><Button disabled={disabled} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? t('website.saving', { done: progress, total: photos.length }) : t('website.savePhotos')}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
