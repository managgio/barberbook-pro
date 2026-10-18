import { useId } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PhotoSourcePicker from '@/components/common/PhotoSourcePicker';
import { useI18n } from '@/hooks/useI18n';
import type usePhotoGridDrag from './usePhotoGridDrag';
import { photoSlotForItem } from './photoGridGeometry';

export type WebsitePhotoDraft = { key: string; url: string; fileId: string; blob?: Blob };
export default function WebsitePhotoGrid({ photos, limit, busy, sorter, onSelect, onRemove }: {
  photos: WebsitePhotoDraft[]; limit: number; busy: boolean; sorter: ReturnType<typeof usePhotoGridDrag>;
  onSelect: (files: FileList, index: number | null) => void; onRemove: (index: number) => void;
}) {
  const { t } = useI18n();
  const instructions = useId();
  const { drag, notice } = sorter;
  const disabled = busy || Boolean(drag);
  const activePhoto = drag ? photos[drag.from] : null;
  return <>
    {photos.length > 1 && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('website.dragHint')}</p>}
    <p id={instructions} className="sr-only">{t('website.dragKeyboardHint')}</p>
    <div ref={sorter.gridRef} role="list" aria-label={t('website.photoOrder')} className="relative isolate mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {drag?.valid && <div aria-hidden="true" data-photo-drop-target className="pointer-events-none absolute rounded-xl border-2 border-dashed border-primary/60 bg-primary/10" style={sorter.placeholderStyle()} />}
      {photos.map((photo, index) => <div key={photo.key} role="listitem" data-photo-key={photo.key} style={sorter.itemStyle(index)}
        className="relative min-w-0 rounded-xl border bg-card p-2 transition-transform duration-200 motion-reduce:transition-none">
        <PhotoSourcePicker disabled={disabled} label={t('website.replacePhoto', { number: index + 1 })} onFiles={(files) => onSelect(files, index)}>
          <button type="button" className="group relative block aspect-[4/5] w-full overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" disabled={disabled} aria-label={t('website.replacePhoto', { number: index + 1 })}>
            <img src={photo.url} alt={t('website.photoNumber', { number: index + 1 })} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-x-1 bottom-1 rounded-md bg-black/70 py-2 text-xs text-white">{t('gallery.replaceImage')}</span>
          </button>
        </PhotoSourcePicker>
        <div className="mt-2 flex h-11 items-center justify-between gap-1">
          {photos.length > 1 ? <Button type="button" variant="ghost" className="h-11 min-w-11 touch-none gap-1.5 px-2 cursor-grab select-none active:cursor-grabbing"
            disabled={busy || Boolean(drag && drag.from !== index)} aria-label={t('website.dragPhoto', { number: index + 1 })} aria-describedby={instructions} {...sorter.handleProps(index)}>
            <GripVertical aria-hidden="true" className="h-4 w-4 text-primary" /><span className="text-xs tabular-nums text-muted-foreground">{(drag ? photoSlotForItem(index, drag.from, drag.to) : index) + 1}</span>
          </Button> : <span className="px-2 text-xs tabular-nums text-muted-foreground">{index + 1}</span>}
          <Button type="button" size="icon" variant="ghost" className="h-11 w-11 text-muted-foreground hover:text-destructive" disabled={disabled}
            aria-label={t('website.removePhoto', { number: index + 1 })} onClick={() => onRemove(index)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>)}
      {photos.length < limit && <div role="presentation" className="min-h-40">
        <PhotoSourcePicker disabled={disabled} multiple={limit > 1} label={t('website.choosePhotos')} onFiles={(files) => onSelect(files, null)}>
          <Button type="button" variant="outline" className="h-full min-h-40 w-full flex-col gap-3 border-dashed whitespace-normal p-4 text-center" disabled={disabled}>
            <ImagePlus className="h-7 w-7 text-primary" />{t('website.addPhotos')}
          </Button>
        </PhotoSourcePicker>
      </div>}
    </div>
    {drag && activePhoto && createPortal(<div aria-hidden="true" data-photo-drag-preview className="pointer-events-none fixed z-[100] select-none rounded-xl border border-primary bg-card p-2 shadow-2xl ring-2 ring-primary/25" style={drag.overlay}>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg"><img src={activePhoto.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" /></div>
      <div className="mt-2 flex h-11 items-center gap-1.5 px-2"><GripVertical className="h-4 w-4 text-primary" /><span className="text-xs tabular-nums">{drag.to + 1}</span></div>
    </div>, document.body)}
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{notice && t(`website.dragNotice.${notice.kind}`, { number: notice.from + 1, position: notice.to + 1, total: photos.length })}</p>
  </>;
}
