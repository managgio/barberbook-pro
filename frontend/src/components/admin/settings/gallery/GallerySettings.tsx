import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical, Images, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { deleteGalleryItem, GalleryCollection, GalleryContent, GalleryItem, getGallery, reorderGallery, saveGalleryItem } from '@/data/api/gallery';
import { ApiRequestError } from '@/lib/networkErrors';
import { cn } from '@/lib/utils';
import { moveOrderedItem, useOrderedListDrag } from '@/hooks/useOrderedListDrag';
import GalleryImage from '@/components/gallery/GalleryImage';
import LandingPublicationControl from '../LandingPublicationControl';
import GalleryEditorDialog from './GalleryEditorDialog';
import GalleryCategories from './GalleryCategories';

export default function GallerySettings() {
  const { currentLocationId } = useTenant();
  const { t } = useI18n();
  const { toast } = useToast();
  const client = useQueryClient();
  const key = ['gallery', currentLocationId, 'admin'];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getGallery(true, signal), enabled: Boolean(currentLocationId) });
  const items = query.data?.items ?? [];
  const categories = query.data?.categories ?? [];
  const imageUsage = query.data?.imageUsage;
  const atCapacity = !imageUsage || imageUsage.used >= imageUsage.limit;
  const [editor, setEditor] = useState<{ item: GalleryItem | null } | null>(null);
  const [deleting, setDeleting] = useState<GalleryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['gallery', currentLocationId] }),
      client.invalidateQueries({ queryKey: ['inline-localization', currentLocationId, 'gallery_item'] }),
      client.invalidateQueries({ queryKey: ['inline-localization', currentLocationId, 'gallery_category'] }),
    ]);
  };
  const perform = async (action: () => Promise<void>) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true);
    try { await action(); return true; } catch (error) {
      const conflict = error instanceof ApiRequestError && error.status === 409;
      const message = error instanceof Error ? error.message : '';
      const hint = message.includes('GALLERY_IMAGE_LIMIT') ? 'gallery.imageLimitHint'
        : message.includes('GALLERY_INVALID_MEDIA') ? 'gallery.invalidMediaHint'
        : message.includes('GALLERY_MEDIA_UNAVAILABLE') ? 'gallery.mediaUnavailableHint'
        : message.includes('GALLERY_CATEGORY_DUPLICATE') ? 'gallery.duplicateCategory'
        : message.includes('GALLERY_CATEGORY_IN_USE') ? 'gallery.categoryInUse'
          : conflict ? (editor ? 'gallery.conflictHint' : 'gallery.listConflictHint') : 'gallery.errorHint';
      toast({ title: t(conflict ? 'admin.faq.conflict' : 'gallery.error'), description: t(hint, { limit: imageUsage?.limit ?? '' }), variant: 'destructive' });
      if (conflict) setDeleting(null);
      await invalidate(); return false;
    } finally { pending.current = false; setBusy(false); }
  };
  const save = (content: GalleryContent) => perform(async () => {
    await saveGalleryItem(editor?.item ?? null, content); setEditor(null); await invalidate(); toast({ title: t('gallery.saved') });
  });
  const move = (from: number, to: number) => {
    const next = moveOrderedItem(items, from, to);
    if (next === items) return;
    void perform(async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = query.data;
      client.setQueryData<GalleryCollection>(key, { ...query.data, categories, items: next });
      try {
        const saved = await reorderGallery(items.map((item) => item.id), next.map((item) => item.id));
        client.setQueryData<GalleryCollection>(key, { ...query.data, categories, items: saved });
        setAnnouncement(t('gallery.moved', { title: items[from].title, position: to + 1 })); await invalidate();
      } catch (error) { client.setQueryData(key, previous); throw error; }
    });
  };
  const { drag, handleProps, rowStyle } = useOrderedListDrag(move, busy, 'gallery');
  return <Card variant="elevated">
    <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="space-y-2">
      <CardTitle className="flex items-center gap-2"><Images className="h-5 w-5 text-primary" />{t('gallery.title')}</CardTitle><p className="max-w-xl text-sm text-muted-foreground">{t('gallery.adminDescription')}</p>
      {imageUsage && <p aria-live="polite" className="text-xs text-muted-foreground"><span className="font-medium tabular-nums text-foreground">{t('gallery.imageUsage', imageUsage)}</span>{' · '}{t('gallery.localImageLimit')}</p>}
      {imageUsage && atCapacity && <p className="max-w-xl text-xs text-muted-foreground">{t('gallery.imageLimitHint', { limit: imageUsage.limit })}</p>}</div>
      <Button className="shrink-0 gap-2" disabled={busy || query.isPending || query.isError || !categories.length || atCapacity} onClick={() => setEditor({ item: null })}><Plus className="h-4 w-4" />{t('gallery.add')}</Button></CardHeader>
    <CardContent className="space-y-5">
      <LandingPublicationControl section="gallery" />
      {query.isPending ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('admin.faq.loading')}</p>
        : query.isError ? <div role="alert" className="space-y-3 rounded-xl border p-6"><p>{t('gallery.error')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('admin.faq.retry')}</Button></div> : <>
          <GalleryCategories categories={categories} items={items} busy={busy} perform={perform} invalidate={invalidate} />
          {!items.length ? <div className="rounded-xl border border-dashed px-5 py-10 text-center"><Images className="mx-auto mb-3 h-9 w-9 text-primary/70" /><h3 className="font-semibold">{t('gallery.empty')}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t(categories.length ? 'gallery.emptyHint' : 'gallery.firstCategoryHint')}</p></div> : <>
            <p id="gallery-drag-hint" className="text-xs text-muted-foreground">{t('admin.faq.dragHint')}</p>
            <ol data-gallery-list className="space-y-3" aria-label={t('gallery.title')} aria-busy={busy}>
              {items.map((item, index) => <li key={item.id} data-gallery-index={index} style={rowStyle(index)} className={cn('relative flex items-start gap-2 rounded-xl border bg-card p-2.5 transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none sm:gap-4 sm:p-4',
                drag?.from === index && 'border-primary shadow-xl ring-2 ring-primary/20 select-none')}>
                <Button variant="ghost" size="icon" className="h-9 w-6 shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing" disabled={busy} aria-label={t('gallery.drag', { title: item.title })} aria-describedby="gallery-drag-hint" {...handleProps(index)} onKeyDown={(event) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(index, index + (event.key === 'ArrowUp' ? -1 : 1)); }
                }}><GripVertical className="h-4 w-4" /></Button>
                <GalleryImage src={item.imageUrl} width={item.imageWidth} height={item.imageHeight} alt="" sizes="96px" className="h-20 w-16 shrink-0 rounded-lg object-cover sm:h-28 sm:w-24" />
                <div className="min-w-0 flex-1 py-1"><p className="text-xs text-muted-foreground">{categories.find((category) => category.id === item.categoryId)?.name}</p>
                  <h3 className="mt-1 break-words text-sm font-semibold">{item.title}</h3>
                  {item.beforeUrl && <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-foreground">{t('gallery.comparison')}</span>}
                  <div className="mt-2 flex flex-wrap gap-1"><Button variant="ghost" size="sm" className="h-8 gap-1 px-2" disabled={busy} onClick={() => setEditor({ item })}><Pencil className="h-3.5 w-3.5" />{t('admin.faq.edit')}</Button><Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => setDeleting(item)}><Trash2 className="h-3.5 w-3.5" />{t('admin.faq.delete')}</Button></div>
                </div>
                <div className="flex shrink-0 flex-col gap-1"><Button variant="ghost" size="icon" className="h-8 w-7" disabled={busy || index === 0} aria-label={t('gallery.up', { title: item.title })} onClick={() => move(index, index - 1)}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-7" disabled={busy || index === items.length - 1} aria-label={t('gallery.down', { title: item.title })} onClick={() => move(index, index + 1)}><ArrowDown className="h-4 w-4" /></Button></div>
              </li>)}
            </ol>
          </>}
        </>}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    </CardContent>
    {editor && imageUsage && <GalleryEditorDialog item={editor.item} categories={categories} busy={busy}
      maxImages={Math.max(0, imageUsage.limit - imageUsage.used) + (editor.item ? 1 + Number(Boolean(editor.item.beforeFileId)) : 0)}
      onClose={() => setEditor(null)} onSave={save} onTranslationUpdated={invalidate} />}
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t('gallery.deleteTitle')}</AlertDialogTitle><AlertDialogDescription>{t('gallery.deleteHint', { title: deleting?.title ?? '' })}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('admin.faq.cancel')}</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={() => void perform(async () => {
        if (!deleting) return;
        await deleteGalleryItem(deleting); setDeleting(null); await invalidate();
      })}>{t('admin.faq.delete')}</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </Card>;
}
