import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, RefreshCw } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { getWebsiteImages, replaceWebsiteImages, WebsiteImageSection, WebsiteImageSelection, WebsiteImagesSnapshot } from '@/data/api/website';
import { ApiRequestError } from '@/lib/networkErrors';
import WebsiteImagePreview from './WebsiteImagePreview';
import WebsiteImageEditor from './WebsiteImageEditor';
import WebsitePhotoGuidance from './WebsitePhotoGuidance';

export default function WebsiteImages() {
  const { currentLocationId, tenant, refreshTenant } = useTenant();
  const { t } = useI18n();
  const { toast } = useToast();
  const client = useQueryClient();
  const key = ['website-images', currentLocationId];
  const [editing, setEditing] = useState<{ section: WebsiteImageSection; revision: string } | null>(null);
  const query = useQuery({ queryKey: key, enabled: Boolean(currentLocationId), queryFn: ({ signal }) => getWebsiteImages(currentLocationId!, signal), refetchInterval: 15_000, refetchOnWindowFocus: 'always' });
  const name = (section: WebsiteImageSection) => section.kind === 'presentation' && section.title?.trim() ? section.title : t(`website.section.${section.kind}`, { number: Number(section.key.slice(-1)) + 1 });
  const save = async (images: WebsiteImageSelection[]) => {
    if (!editing || !currentLocationId) return false;
    try {
      const saved = await replaceWebsiteImages(currentLocationId, editing.section.key, editing.revision, images);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<WebsiteImagesSnapshot>(key, saved);
      setEditing(null);
      await refreshTenant();
      toast({ title: t('website.saved') });
      return true;
    } catch (error) {
      toast({ title: t('website.saveError'), description: t(error instanceof ApiRequestError && error.status === 409 ? 'website.conflict' : 'website.errorHint'), variant: 'destructive' });
      void query.refetch();
      return false;
    }
  };
  if (query.isPending) return <p role="status" className="py-10 text-sm text-muted-foreground">{t('admin.faq.loading')}</p>;
  if (query.isError) return <div role="alert" className="space-y-3 rounded-2xl border p-6"><p>{t('website.loadError')}</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />{t('admin.faq.retry')}</Button></div>;
  return <div className="space-y-6">
    <div><h2 className="text-lg font-semibold">{t('website.images')}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('website.imagesHint')}</p></div>
    <div className="grid items-stretch gap-5 md:grid-cols-2 2xl:grid-cols-3 lg:gap-6">
      {query.data.sections.map((section) => <article key={section.key} className="group flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <WebsiteImagePreview section={section} />
        <div className="mt-4 space-y-2"><p className="text-xs font-medium uppercase tracking-wider text-primary">{t(`website.position.${section.kind}`)}</p><h3 className="break-words text-lg font-semibold">{name(section)}</h3><p className="text-sm leading-relaxed text-muted-foreground">{t(`website.hint.${section.kind}`)}</p></div>
        <div className="mt-4"><WebsitePhotoGuidance kind={section.kind} /></div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5"><span className="text-xs text-muted-foreground">{!section.images.length ? t('website.noPhoto') : section.kind === 'hero' ? t(section.images.length > 1 ? 'website.slideshow' : 'website.fixed') : t('website.publishedImage')}</span><Button variant="outline" className="gap-2" onClick={() => setEditing({ section, revision: query.data.revision })}>{section.images.length ? <Pencil className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}{t(section.images.length ? 'website.changePhotos' : 'website.addPhotos')}</Button></div>
      </article>)}
    </div>
    {editing && tenant?.brand?.id && currentLocationId && <WebsiteImageEditor section={editing.section} title={name(editing.section)} brandId={tenant.brand.id} localId={currentLocationId} onClose={() => setEditing(null)} onSave={save} />}
  </div>;
}
