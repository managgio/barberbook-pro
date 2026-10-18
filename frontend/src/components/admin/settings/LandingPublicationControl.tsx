import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { getLandingPublication, LandingPublicationSection, updateLandingPublication } from '@/data/api/landingPublication';

export default function LandingPublicationControl({ section }: { section: LandingPublicationSection }) {
  const { tenant, currentLocationId } = useTenant();
  const { t } = useI18n();
  const { toast } = useToast();
  const client = useQueryClient();
  const key = ['landing-publication', currentLocationId, section];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getLandingPublication(section, signal), enabled: Boolean(currentLocationId) });
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const change = async (published: boolean) => {
    if (!query.data || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const saved = await updateLandingPublication(section, { published, version: query.data.version });
      client.setQueryData(key, saved);
      await client.invalidateQueries({ queryKey: [section === 'faq' ? 'faqs' : 'gallery', currentLocationId] });
      toast({ title: t(saved.published ? 'admin.publication.shown' : 'admin.publication.hidden') });
    } catch {
      toast({ title: t('admin.publication.error'), description: t('admin.publication.errorHint'), variant: 'destructive' });
      await query.refetch();
    } finally { pending.current = false; setBusy(false); }
  };
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex min-w-0 gap-3">
        {query.data?.published ? <Eye className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
        <div className="space-y-1">
          <Label htmlFor={`publish-${section}`} className="font-semibold">{t('admin.publication.label')}</Label>
          <p id={`publish-${section}-hint`} className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{t('admin.publication.hint')}</p>
          {tenant?.config?.landing?.hiddenSections?.includes(section) && <p className="pt-1 text-xs font-medium">{t('admin.publication.platformHidden')}</p>}
          {query.isError && <div role="alert" className="pt-2 text-sm"><p>{t('admin.publication.error')}</p><Button variant="link" className="h-8 p-0" onClick={() => void query.refetch()}>{t('admin.faq.retry')}</Button></div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {(busy || query.isPending) && <Loader2 aria-label={t('admin.faq.loading')} className="h-4 w-4 animate-spin" />}
        <Switch id={`publish-${section}`} aria-describedby={`publish-${section}-hint`} checked={query.data?.published ?? false}
          disabled={busy || !query.data || query.isError} onCheckedChange={(value) => void change(value)} />
      </div>
    </div>
  );
}
