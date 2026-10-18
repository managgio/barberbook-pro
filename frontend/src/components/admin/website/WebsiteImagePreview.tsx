import { Image as ImageIcon } from 'lucide-react';
import { WebsiteImageSection } from '@/data/api/website';
import { cn } from '@/lib/utils';

export default function WebsiteImagePreview({ section }: { section: WebsiteImageSection }) {
  const main = section.images[0];
  return <div className="relative isolate aspect-[16/10] shrink-0 overflow-hidden rounded-xl border bg-muted/30" aria-hidden="true">
    {main ? <img src={main.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
      : <div className="flex h-full min-h-36 items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/40" /></div>}
    {(section.kind === 'background' || section.kind === 'cta') && <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-black/45 px-8"><div className="h-3 w-2/3 rounded-full bg-white/80" /><div className="h-2 w-1/2 rounded-full bg-white/40" /><div className="mt-2 h-6 w-20 rounded-lg bg-primary" /></div>}
    {section.kind === 'hero' && section.images.length > 1 && <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">{section.images.map((photo, index) => <img key={`${photo.url}-${index}`} src={photo.url} alt="" loading="lazy" className={cn('h-10 w-8 rounded-md border object-cover', index === 0 ? 'border-white' : 'border-white/30')} />)}</div>}
  </div>;
}
