import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';
import { deleteGalleryCategory, GalleryCategory, GalleryItem, GALLERY_LIMITS, saveGalleryCategory } from '@/data/api/gallery';
import { useI18n } from '@/hooks/useI18n';

export default function GalleryCategories({ categories, items, busy, perform, invalidate }: {
  categories: GalleryCategory[]; items: GalleryItem[]; busy: boolean;
  perform: (action: () => Promise<void>) => Promise<boolean>; invalidate: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<GalleryCategory | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<GalleryCategory | null>(null);
  const cancel = () => { setEditing(null); setName(''); };
  return <div className="space-y-4 rounded-xl border bg-background/50 p-4">
    <div><h3 className="font-semibold">{t('gallery.categories')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('gallery.categoriesHint')}</p></div>
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
      event.preventDefault();
      if (!name.trim() || busy) return;
      void perform(async () => { await saveGalleryCategory(editing, name.trim()); cancel(); await invalidate(); });
    }}>
      <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="gallery-category-name">{t(editing ? 'gallery.renameCategory' : 'gallery.newCategory')}</Label>
        <Input id="gallery-category-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={GALLERY_LIMITS.category} required disabled={busy} placeholder={t('gallery.categoryPlaceholder')} /></div>
      {editing && <Button type="button" variant="ghost" size="icon" onClick={cancel} disabled={busy} aria-label={t('admin.faq.cancel')}><X className="h-4 w-4" /></Button>}
      <Button type="submit" variant="outline" disabled={busy || !name.trim() || (!editing && categories.length >= GALLERY_LIMITS.categories)}>
        {editing ? t('admin.faq.save') : <><Plus className="mr-1 h-4 w-4" />{t('gallery.addCategory')}</>}
      </Button>
    </form>
    <div className="grid gap-2 sm:grid-cols-2">
      {categories.map((category) => {
        const count = items.filter((item) => item.categoryId === category.id).length;
        return <div key={category.id} className="flex min-w-0 items-center gap-1 rounded-lg border px-3 py-2">
          <span className="min-w-0 flex-1 break-words text-sm">{category.name} <span className="text-xs tabular-nums text-muted-foreground">({count})</span></span>
          <InlineTranslationPopover entityType="gallery_category" entityId={category.id} fieldKey="name" onUpdated={invalidate} />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={busy} onClick={() => { setEditing(category); setName(category.name); }} aria-label={t('gallery.editCategory', { name: category.name })}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" disabled={busy || count > 0}
            title={count > 0 ? t('gallery.categoryInUse') : undefined} onClick={() => setDeleting(category)} aria-label={t('gallery.deleteCategory', { name: category.name })}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>;
      })}
    </div>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('gallery.deleteCategoryTitle')}</AlertDialogTitle><AlertDialogDescription>{t('gallery.deleteCategoryHint', { name: deleting?.name ?? '' })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('admin.faq.cancel')}</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={() => void perform(async () => {
          if (!deleting) return;
          await deleteGalleryCategory(deleting); if (editing?.id === deleting.id) cancel(); setDeleting(null); await invalidate();
        })}>{t('admin.faq.delete')}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
