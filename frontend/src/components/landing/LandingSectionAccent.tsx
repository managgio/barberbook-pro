import { cn } from '@/lib/utils';

export default function LandingSectionAccent({ centered = false }: { centered?: boolean }) {
  return <div aria-hidden="true" className={cn('mb-4 flex items-center gap-1.5', centered && 'justify-center')}>
    <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/40" />
  </div>;
}
