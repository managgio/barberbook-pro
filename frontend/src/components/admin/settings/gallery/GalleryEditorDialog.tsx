import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';
import { GalleryCategory, GalleryContent, GalleryItem, GALLERY_LIMITS } from '@/data/api/gallery';
import { useI18n } from '@/hooks/useI18n';
import { useTenant } from '@/context/TenantContext';
import { uploadToImageKit } from '@/lib/imagekit';
import GalleryImagePicker, { GalleryPhotoDraft } from './GalleryImagePicker';
import { galleryImageExtension } from '@/lib/galleryImages';

export default function GalleryEditorDialog({ item, categories, busy, maxImages, onClose, onSave, onTranslationUpdated }: {
  item: GalleryItem | null; categories: GalleryCategory[]; busy: boolean; maxImages: number; onClose: () => void;
  onSave: (content: GalleryContent) => Promise<boolean>; onTranslationUpdated: () => Promise<void>;
}) {
  const { t } = useI18n();
  const { currentLocationId } = useTenant();
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '');
  const [image, setImage] = useState<GalleryPhotoDraft | null>(item ? { url: item.imageUrl, fileId: item.imageFileId } : null);
  const [before, setBefore] = useState<GalleryPhotoDraft | null>(item?.beforeUrl ? { url: item.beforeUrl, fileId: item.beforeFileId } : null);
  const [imageBusy, setImageBusy] = useState(false);
  const [beforeBusy, setBeforeBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const disabled = busy || uploading || imageBusy || beforeBusy;
  const exceedsCapacity = 1 + Number(Boolean(before)) > maxImages;
  const submit = async () => {
    if (disabled || submitting.current || exceedsCapacity || !image || !title.trim() || !categoryId || !currentLocationId) return;
    submitting.current = true; setUploading(true); setError(false);
    const upload = async (photo: GalleryPhotoDraft, update: (photo: GalleryPhotoDraft) => void) => {
      if (photo.fileId) return photo.fileId;
      if (!photo.blob) throw new Error('MISSING_IMAGE');
      const extension = galleryImageExtension(photo.blob);
      const result = await uploadToImageKit(photo.blob, `work-${crypto.randomUUID()}.${extension}`, `gallery/${currentLocationId}`, {
        localIdOverride: currentLocationId, signal: AbortSignal.timeout(90_000),
      });
      if (!result.fileId || !result.url) throw new Error('INVALID_UPLOAD_RESPONSE');
      if (mounted.current) update({ ...result });
      return result.fileId;
    };
    try {
      const imageFileId = await upload(image, setImage);
      if (!mounted.current) return;
      const beforeFileId = before ? await upload(before, setBefore) : null;
      if (mounted.current) await onSave({ title: title.trim(), description: description.trim(), categoryId, imageFileId, beforeFileId });
    } catch { if (mounted.current) setError(true); }
    finally { submitting.current = false; if (mounted.current) setUploading(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !disabled) onClose(); }}>
    <DialogContent className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl">
      <DialogHeader><DialogTitle>{t(item ? 'gallery.edit' : 'gallery.add')}</DialogTitle><DialogDescription>{t('gallery.editorHint')}</DialogDescription></DialogHeader>
      <form className="flex min-h-0 flex-col gap-5 overflow-hidden" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="grid min-h-0 gap-6 overflow-y-auto pr-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <GalleryImagePicker label={t('gallery.result')} value={image} onChange={setImage} disabled={disabled} onBusyChange={setImageBusy} />
              <GalleryImagePicker label={t('gallery.before')} value={before} onChange={setBefore} disabled={disabled || (!before && maxImages < 2)} optional onBusyChange={setBeforeBusy} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('gallery.imageHint')}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('gallery.comparisonImageLimit')}</p>
            {maxImages < 2 && !before && <p className="text-xs text-muted-foreground">{t('gallery.noComparisonCapacity')}</p>}
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="gallery-title">{t('gallery.workTitle')}</Label>
              {item && <InlineTranslationPopover entityType="gallery_item" entityId={item.id} fieldKey="title" onUpdated={onTranslationUpdated} />}</div>
              <Input id="gallery-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={GALLERY_LIMITS.title} disabled={disabled} placeholder={t('gallery.titlePlaceholder')} /></div>
            <div className="space-y-2"><Label htmlFor="gallery-category">{t('gallery.category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={disabled}><SelectTrigger id="gallery-category"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="gallery-description">{t('gallery.workDescription')}</Label>
              {item && <InlineTranslationPopover entityType="gallery_item" entityId={item.id} fieldKey="description" onUpdated={onTranslationUpdated} />}</div>
              <Textarea id="gallery-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={GALLERY_LIMITS.description} disabled={disabled} />
              <p className="text-right text-xs tabular-nums text-muted-foreground">{description.length}/{GALLERY_LIMITS.description}</p></div>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{t('gallery.uploadError')}</p>}
        {exceedsCapacity && <p role="alert" className="text-sm text-destructive">{t('gallery.capacityChanged')}</p>}
        <DialogFooter className="shrink-0 gap-2"><Button type="button" variant="outline" disabled={disabled} onClick={onClose}>{t('admin.faq.cancel')}</Button>
          <Button type="submit" disabled={disabled || exceedsCapacity || !title.trim() || !categoryId || !image}>{disabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t(uploading ? 'gallery.uploading' : 'gallery.save')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
