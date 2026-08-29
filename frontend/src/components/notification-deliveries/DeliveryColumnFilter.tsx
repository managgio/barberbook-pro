import { useState } from 'react';
import { Check, ListFilter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DeliveryFilterOption = { value: string; label: string };

type DeliveryColumnFilterProps = {
  label: string;
  value: string;
  options: DeliveryFilterOption[];
  onChange: (value: string) => void;
  className?: string;
};

export const DeliveryColumnFilter = ({
  label,
  value,
  options,
  onChange,
  className,
}: DeliveryColumnFilterProps) => {
  const [open, setOpen] = useState(false);
  return (
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('relative h-7 w-7', className)}
        aria-label={`Filtrar por ${label.toLowerCase()}`}
      >
        <ListFilter className={cn('h-3.5 w-3.5', value !== 'all' && 'text-primary')} />
        {value !== 'all' && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-56 p-2">
      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <span>{option.label}</span>
            <Check className={cn('h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
          </button>
        ))}
      </div>
    </PopoverContent>
  </Popover>
  );
};
