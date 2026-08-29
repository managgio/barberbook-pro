import * as React from 'react';

import type { SlidingIndicatorRect } from '@/hooks/useSlidingIndicator';
import { cn } from '@/lib/utils';

type SlidingSelectionIndicatorProps = {
  className?: string;
  indicator: SlidingIndicatorRect | null;
  testId?: string;
};

export const SlidingSelectionIndicator: React.FC<SlidingSelectionIndicatorProps> = ({
  className,
  indicator,
  testId,
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute left-0 top-0 z-0 transition-[transform,width,height,opacity] duration-300 ease-out motion-reduce:transition-none',
      className,
    )}
    data-testid={testId}
    style={{
      width: indicator?.width ?? 0,
      height: indicator?.height ?? 0,
      borderRadius: indicator?.borderRadius || undefined,
      opacity: indicator ? 1 : 0,
      transform: `translate3d(${indicator?.x ?? 0}px, ${indicator?.y ?? 0}px, 0)`,
    }}
  />
);
