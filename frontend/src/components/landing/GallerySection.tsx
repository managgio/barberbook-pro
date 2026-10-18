import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronsLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGallery } from '@/data/api/gallery';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import GalleryImage from '@/components/gallery/GalleryImage';
import GalleryLightbox from '@/components/gallery/GalleryLightbox';
import LandingSectionAccent from './LandingSectionAccent';

export default function GallerySection() {
  const { tenant, currentLocationId } = useTenant();
  const { t, language } = useI18n();
  const enabled = tenant?.config?.features?.galleryEnabled === true;
  const query = useQuery({ queryKey: ['gallery', currentLocationId, language], queryFn: ({ signal }) => getGallery(false, signal), enabled: enabled && Boolean(currentLocationId) });
  const [categoryId, setCategoryId] = useState('all');
  const [limit, setLimit] = useState(12);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!enabled || !query.data?.items.length) return null;
  const { items, categories } = query.data;
  const available = categories.filter((category) => items.some((item) => item.categoryId === category.id));
  const activeCategory = categoryId === 'all' || available.some((category) => category.id === categoryId) ? categoryId : 'all';
  const filtered = activeCategory === 'all' ? items : items.filter((item) => item.categoryId === activeCategory);
  return <section id="gallery" aria-labelledby="gallery-heading" className="border-t border-border/50 py-12 sm:py-20">
    <div className="container max-w-6xl px-4">
      <div className="mb-7 max-w-2xl space-y-3 sm:mb-10"><LandingSectionAccent /><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('gallery.eyebrow')}</p>
        <h2 id="gallery-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">{t('gallery.landingTitle')}</h2><p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{t('gallery.landingDescription')}</p></div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label={t('gallery.filter')}>
        {[{ id: 'all', name: t('gallery.all') }, ...available].map((category) => <button key={category.id} type="button" aria-pressed={category.id === activeCategory}
          onClick={() => { setCategoryId(category.id); setLimit(12); }} className={cn('shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            category.id === activeCategory ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground')}>
          {category.name}
        </button>)}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-6 lg:grid-cols-3">
        {filtered.slice(0, limit).map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} aria-label={t('gallery.view', { title: item.title })}
          className="group min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted sm:rounded-2xl">
            <GalleryImage src={item.imageUrl} width={item.imageWidth} height={item.imageHeight} alt="" sizes="(min-width: 1152px) 360px, (min-width: 1024px) 31vw, 48vw" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" />
            <span aria-hidden="true" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm sm:right-3 sm:top-3"><ArrowUpRight className="h-4 w-4" /></span>
            {item.beforeUrl && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white sm:bottom-3 sm:left-3 sm:px-3 sm:text-xs"><ChevronsLeftRight className="h-3 w-3" />{t('gallery.comparison')}</span>}
          </div>
          <div className="px-0.5 pt-3"><p className="truncate text-[11px] text-muted-foreground sm:text-xs">{categories.find((category) => category.id === item.categoryId)?.name}</p>
            <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-snug sm:text-base">{item.title}</h3></div>
        </button>)}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{t('gallery.results', { count: filtered.length })}</p>
      {filtered.length > limit && <div className="mt-8 text-center"><Button variant="outline" className="rounded-full px-8" onClick={() => setLimit((value) => value + 12)}>{t('gallery.more')}</Button></div>}
      {selectedId && <GalleryLightbox items={filtered} categories={categories} selectedId={selectedId} onSelect={setSelectedId} onClose={() => setSelectedId(null)} />}
    </div>
  </section>;
}
