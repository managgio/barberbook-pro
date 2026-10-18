import { useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronsLeftRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GalleryCategory, GalleryItem } from '@/data/api/gallery';
import { useI18n } from '@/hooks/useI18n';
import GalleryImage from './GalleryImage';

function WorkImage({ item }: { item: GalleryItem }) {
  const { t } = useI18n();
  const [position, setPosition] = useState(50);
  const dragging = useRef<number | null>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const compareAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width) setPosition(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
  };
  return <div className="space-y-3">
    <div className={`relative h-[52dvh] overflow-hidden rounded-xl bg-muted/40 sm:h-[60dvh] ${item.beforeUrl ? 'touch-pan-y cursor-ew-resize select-none' : ''}`}
      onPointerDown={(event) => {
        if (!item.beforeUrl || event.button !== 0 || event.isPrimary === false || dragging.current !== null) return;
        handle.current?.focus({ preventScroll: true });
        dragging.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); compareAt(event);
      }} onPointerMove={(event) => { if (dragging.current === event.pointerId) compareAt(event); }}
      onPointerUp={(event) => { if (dragging.current === event.pointerId) dragging.current = null; }}
      onPointerCancel={(event) => { if (dragging.current === event.pointerId) dragging.current = null; }}
      onLostPointerCapture={(event) => { if (dragging.current === event.pointerId) dragging.current = null; }}
      onDragStart={(event) => event.preventDefault()}>
      <GalleryImage src={item.imageUrl} width={item.imageWidth} height={item.imageHeight} alt={item.title} sizes="(max-width: 640px) 100vw, 80vw" eager className="h-full w-full object-contain" />
      {item.beforeUrl && <>
        <div className="absolute inset-0 bg-muted" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <GalleryImage src={item.beforeUrl} width={item.beforeWidth ?? item.imageWidth} height={item.beforeHeight ?? item.imageHeight}
            alt={t('gallery.beforeAlt', { title: item.title })} sizes="(max-width: 640px) 100vw, 80vw" eager className="h-full w-full object-contain" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-sm" style={{ left: `${position}%` }} />
        <button ref={handle} type="button" role="slider" aria-label={t('gallery.comparison')} aria-describedby={hintId}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={position} aria-valuetext={t('gallery.compareValue', { value: position })} aria-orientation="horizontal"
          className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/50 bg-black/70 text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ left: `clamp(24px, ${position}%, calc(100% - 24px))` }}
          onKeyDown={(event) => {
            const steps: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -10, PageUp: 10 };
            if (event.key !== 'Home' && event.key !== 'End' && steps[event.key] === undefined) return;
            event.preventDefault(); event.stopPropagation();
            setPosition((current) => event.key === 'Home' ? 0 : event.key === 'End' ? 100 : Math.max(0, Math.min(100, current + steps[event.key])));
          }}><ChevronsLeftRight aria-hidden="true" className="h-5 w-5" /></button>
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">{t('gallery.before')}</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">{t('gallery.after')}</span>
      </>}
    </div>
    {item.beforeUrl && <p id={hintId} className="text-center text-xs text-muted-foreground">{t('gallery.compareHint')}</p>}
  </div>;
}

export default function GalleryLightbox({ items, categories, selectedId, onSelect, onClose }: {
  items: GalleryItem[]; categories: GalleryCategory[]; selectedId: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const index = items.findIndex((item) => item.id === selectedId);
  const item = items[index];
  if (!item) return null;
  const navigate = (direction: number) => { const next = items[index + direction]; if (next) onSelect(next.id); };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[94dvh] gap-4 overflow-y-auto p-4 sm:max-w-5xl sm:p-6" onKeyDown={(event) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigate(event.key === 'ArrowLeft' ? -1 : 1); }
    }}>
      <DialogHeader className="pr-8 text-left"><DialogTitle className="break-words leading-snug">{item.title}</DialogTitle>
        <DialogDescription>{categories.find((category) => category.id === item.categoryId)?.name}</DialogDescription></DialogHeader>
      <WorkImage key={item.id} item={item} />
      {item.description && <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="icon" disabled={index === 0} onClick={() => navigate(-1)} aria-label={t('gallery.previous')}><ArrowLeft className="h-4 w-4" /></Button>
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{index + 1} / {items.length}</p>
        <Button variant="outline" size="icon" disabled={index === items.length - 1} onClick={() => navigate(1)} aria-label={t('gallery.next')}><ArrowRight className="h-4 w-4" /></Button>
      </div>
    </DialogContent>
  </Dialog>;
}
