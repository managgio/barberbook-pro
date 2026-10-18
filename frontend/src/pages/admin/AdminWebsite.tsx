import { lazy, Suspense, useEffect, useState } from 'react';
import { Image, Images, MessageCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import { useI18n } from '@/hooks/useI18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { websiteTabs, WebsiteTab } from '@/lib/website';

const WebsiteImages = lazy(() => import('@/components/admin/website/WebsiteImages'));
const GallerySettings = lazy(() => import('@/components/admin/settings/gallery/GallerySettings'));
const FaqSettings = lazy(() => import('@/components/admin/settings/faqs/FaqSettings'));
const tabMeta = { images: { label: 'website.images', icon: Image }, gallery: { label: 'gallery.title', icon: Images }, faq: { label: 'admin.faq.title', icon: MessageCircle } };

function WebsiteContent() {
  const { tenant, currentLocationId } = useTenant();
  const { t } = useI18n();
  const tabs = websiteTabs(tenant?.config);
  const [selected, setSelected] = useState<WebsiteTab>('images');
  const active = tabs.includes(selected) ? selected : tabs[0];
  const content = (tab: WebsiteTab) => <Suspense fallback={<p role="status" className="py-10 text-sm text-muted-foreground">{t('admin.faq.loading')}</p>}>
    {tab === 'images' ? <WebsiteImages key={currentLocationId} /> : tab === 'gallery' ? <GallerySettings key={currentLocationId} /> : <FaqSettings key={currentLocationId} />}
  </Suspense>;
  return <div className="space-y-6 pb-10 animate-fade-in">
    <div className="pl-12 md:pl-0"><h1 className="text-3xl font-bold text-foreground">{t('website.title')}</h1><p className="mt-1 text-muted-foreground">{t('website.description')}</p></div>
    {tabs.length === 1 ? content(tabs[0]) : <Tabs value={active} onValueChange={(value) => setSelected(value as WebsiteTab)} className="space-y-6">
      <div className="overflow-x-auto pb-1"><TabsList className="h-auto w-max justify-start gap-1 rounded-xl bg-muted/60 p-1">
        {tabs.map((tab) => { const Icon = tabMeta[tab].icon; return <TabsTrigger key={tab} value={tab} className="min-h-10 gap-2 whitespace-nowrap px-4"><Icon className="h-4 w-4" />{t(tabMeta[tab].label)}</TabsTrigger>; })}
      </TabsList></div>
      {tabs.map((tab) => <TabsContent key={tab} value={tab} className="mt-0">{active === tab && content(tab)}</TabsContent>)}
    </Tabs>}
  </div>;
}

export default function AdminWebsite() {
  const { currentLocationId, refreshTenant } = useTenant();
  const { canAccessSection, isLoading } = useAdminPermissions();
  const { t } = useI18n();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshTenant(); };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [refreshTenant]);
  if (isLoading) return <p role="status">{t('admin.faq.loading')}</p>;
  if (!canAccessSection('website')) return <Navigate to="/admin" replace />;
  return <WebsiteContent key={currentLocationId} />;
}
