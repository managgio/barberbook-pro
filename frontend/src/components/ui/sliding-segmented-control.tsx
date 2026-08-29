import React from 'react';

import { SlidingSelectionIndicator } from '@/components/ui/sliding-indicator';
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator';
import { cn } from '@/lib/utils';

export type SlidingSegmentedOption = {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

type SlidingSegmentedControlProps = {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: string) => void;
  optionClassName?: string;
  options: SlidingSegmentedOption[];
  value: string;
};

const SlidingSegmentedControl: React.FC<SlidingSegmentedControlProps> = ({
  ariaLabel,
  className,
  onValueChange,
  optionClassName,
  options,
  value,
}) => {
  const { containerRef, indicator } = useSlidingIndicator<HTMLDivElement>({
    activeKey: `${value}:${options.map((option) => option.value).join(',')}`,
    activeSelector: '[data-segmented-option][data-sliding-active="true"]',
  });

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative isolate inline-flex rounded-lg border border-border/70 bg-muted/30 p-1',
        className,
      )}
    >
      <SlidingSelectionIndicator
        indicator={indicator}
        testId="segmented-control-sliding-indicator"
        className="bg-background shadow-sm"
      />
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            data-segment-index={index}
            data-segmented-option
            data-sliding-active={active ? 'true' : 'false'}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-transparent px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              optionClassName,
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SlidingSegmentedControl;
