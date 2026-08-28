import React from 'react';

import { cn } from '@/lib/utils';

type StaffHorizontalScrollerProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-label'> & {
  scrollable: boolean;
  label?: string;
};

const StaffHorizontalScroller = React.forwardRef<HTMLDivElement, StaffHorizontalScrollerProps>(
  ({ className, scrollable, label, children, ...props }, ref) => (
    <div
      ref={ref}
      role={scrollable ? 'region' : undefined}
      aria-label={scrollable ? label : undefined}
      tabIndex={scrollable ? 0 : undefined}
      className={cn(
        'min-w-0 max-w-full',
        scrollable
          ? 'flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 pr-2 sm:block sm:max-h-[420px] sm:space-y-3 sm:overflow-x-hidden sm:overflow-y-auto sm:pr-1 sm:snap-none'
          : 'space-y-2 sm:space-y-3 sm:pr-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

StaffHorizontalScroller.displayName = 'StaffHorizontalScroller';

export default StaffHorizontalScroller;
