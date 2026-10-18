import LandingPublicationControl from '../LandingPublicationControl';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { createFaq, deleteFaq, Faq, FaqContent, FAQ_LIMITS, getFaqs, reorderFaqs, updateFaq } from '@/data/api/faqs';
import { queryKeys } from '@/lib/queryKeys';
import { ApiRequestError } from '@/lib/networkErrors';
import { cn } from '@/lib/utils';
import FaqEditorDialog from './FaqEditorDialog';
import { moveFaq, useFaqDrag } from './useFaqDrag';

export default function FaqSettings() {
  const { currentLocationId } = useTenant();
  const { t } = useI18n();
  const { toast } = useToast();
  const client = useQueryClient();
  const key = queryKeys.faqs(currentLocationId, 'admin');
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getFaqs(true, signal), enabled: Boolean(currentLocationId) });
  const items = query.data ?? [];
  const [editor, setEditor] = useState<{ faq: Faq | null } | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [announcement, setAnnouncement] = useState('');

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['faqs', currentLocationId] });
    await client.invalidateQueries({ queryKey: ['inline-localization', currentLocationId, 'faq'] });
  };

  const perform = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { await action(); } catch (error) {
      const conflict = error instanceof ApiRequestError && error.status === 409;
      toast({ title: t(conflict ? 'admin.faq.conflict' : 'admin.faq.error'),
        description: t(conflict ? (editor ? 'admin.faq.conflictHint' : 'admin.faq.orderConflictHint') : 'admin.faq.errorHint'), variant: 'destructive' });
      if (conflict) setDeleting(null);
      await invalidate();
    } finally { pending.current = false; setBusy(false); }
  };

  const save = (content: FaqContent) => perform(async () => {
    if (editor?.faq) await updateFaq(editor.faq.id, editor.faq.version, content);
    else await createFaq(content);
    setEditor(null);
    await invalidate();
    toast({ title: t('admin.faq.saved') });
  });

  const move = (from: number, to: number) => {
    const next = moveFaq(items, from, to);
    if (next === items) return;
    void perform(async () => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, next);
      try {
        const saved = await reorderFaqs(items.map((item) => item.id), next.map((item) => item.id));
        client.setQueryData(key, saved);
        setAnnouncement(t('admin.faq.moved', { question: items[from].question, position: to + 1 }));
        await invalidate();
      } catch (error) { client.setQueryData(key, items); throw error; }
    });
  };
  const { drag, handleProps, rowStyle } = useFaqDrag(move, busy);

  return (
    <Card variant="elevated">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" />{t('admin.faq.title')}</CardTitle>
          <p className="max-w-xl text-sm text-muted-foreground">{t('admin.faq.description')}</p>
        </div>
        <Button className="shrink-0 gap-2" onClick={() => setEditor({ faq: null })} disabled={busy || query.isPending || query.isError || items.length >= FAQ_LIMITS.items}>
          <Plus className="h-4 w-4" />{t('admin.faq.add')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <LandingPublicationControl section="faq" />
        {query.isPending ? <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('admin.faq.loading')}</div>
          : query.isError ? <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-6"><p>{t('admin.faq.error')}</p><Button variant="outline" onClick={() => void query.refetch()}>{t('admin.faq.retry')}</Button></div>
          : items.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/20 px-5 py-12 text-center">
            <HelpCircle className="mb-4 h-10 w-10 text-primary/70" /><h3 className="font-semibold">{t('admin.faq.empty')}</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('admin.faq.emptyHint')}</p>
            <Button variant="outline" className="mt-5" onClick={() => setEditor({ faq: null })}>{t('admin.faq.add')}</Button>
          </div> : <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p id="faq-drag-instructions">{t('admin.faq.dragHint')}</p><span className="tabular-nums">{items.length}/{FAQ_LIMITS.items}</span>
            </div>
            <ol data-faq-list className="space-y-3" aria-label={t('admin.faq.title')} aria-busy={busy}>
              {items.map((faq, index) => <li key={faq.id} data-faq-index={index} style={rowStyle(index)} className={cn(
                'relative flex items-start gap-2 rounded-xl border bg-card p-3 transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none sm:gap-3 sm:p-4',
                drag?.from === index && 'border-primary shadow-xl ring-2 ring-primary/20 select-none',
              )}>
                <Button variant="ghost" size="icon" className="h-9 w-8 shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing" disabled={busy}
                  aria-describedby="faq-drag-instructions" aria-label={t('admin.faq.drag', { question: faq.question })} {...handleProps(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(index, index + (event.key === 'ArrowUp' ? -1 : 1)); }
                  }}><GripVertical className="h-4 w-4" /></Button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2"><span className="text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><h3 className="break-words text-sm font-semibold">{faq.question}</h3></div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </div>
                <div className="ml-auto flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button variant="ghost" size="sm" className="h-10 w-10 gap-1.5 p-0 sm:w-auto sm:px-3" onClick={() => setEditor({ faq })} disabled={busy}><Pencil className="h-4 w-4" /><span className="sr-only sm:not-sr-only">{t('admin.faq.edit')}</span></Button>
                  <Button variant="ghost" size="sm" className="h-10 w-10 gap-1.5 p-0 text-muted-foreground hover:text-destructive sm:w-auto sm:px-3" onClick={() => setDeleting(faq)} disabled={busy}><Trash2 className="h-4 w-4" /><span className="sr-only sm:not-sr-only">{t('admin.faq.delete')}</span></Button>
                </div>
              </li>)}
            </ol>
          </>}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </CardContent>
      {editor && <FaqEditorDialog faq={editor.faq} busy={busy} onClose={() => setEditor(null)} onSave={save} onTranslationUpdated={invalidate} />}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('admin.faq.deleteTitle')}</AlertDialogTitle><AlertDialogDescription>{t('admin.faq.deleteHint', { question: deleting?.question ?? '' })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('admin.faq.cancel')}</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void perform(async () => {
              if (!deleting) return;
              await deleteFaq(deleting.id, deleting.version); setDeleting(null); await invalidate();
              toast({ title: t('admin.faq.deleted') });
            })}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('admin.faq.delete')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
