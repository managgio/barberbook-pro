import { cn } from '@/lib/utils';
import LandingSectionAccent from './LandingSectionAccent';

type Presentation = { enabled: boolean; title: string; body: string; imageUrl: string; imagePosition: 'left' | 'right' };
export default function LandingPresentation({ sections, brandName }: { sections: Presentation[]; brandName: string }) {
  const visible = sections.filter((section) => section.enabled && (section.title || section.body || section.imageUrl));
  if (!visible.length) return null;
  return <section className="bg-background py-10 sm:py-16">
    <div className="container max-w-6xl space-y-10 px-4 sm:space-y-16">
      {visible.map((section, index) => <div key={index} className="grid items-center gap-6 md:grid-cols-2 md:gap-10 lg:gap-14">
        <div className={cn('w-full max-w-[480px] justify-self-center', section.imagePosition === 'right' && 'md:order-2')}>
          <div className="relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl border border-primary/20 bg-muted/20 shadow-lg sm:rounded-3xl">
            <img src={section.imageUrl || '/placeholder.svg'} alt={section.title || brandName} loading="lazy" decoding="async" width={1200} height={900} className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-primary/70" />
          </div>
        </div>
        <div className="min-w-0 space-y-3 sm:space-y-4">
          <LandingSectionAccent />
          {section.title && <h3 className="text-xl font-semibold text-foreground sm:text-3xl">{section.title}</h3>}
          {section.body && <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{section.body}</p>}
        </div>
      </div>)}
    </div>
  </section>;
}
