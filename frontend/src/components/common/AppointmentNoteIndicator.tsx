import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AppointmentNoteIndicatorProps {
  note?: string | null;
  variant?: 'icon' | 'pill';
  className?: string;
}

const AppointmentNoteIndicator: React.FC<AppointmentNoteIndicatorProps> = ({
  note,
  variant = 'icon',
  className,
}) => {
  const [clickMode, setClickMode] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(hover: none), (pointer: coarse)');
    const sync = () => setClickMode(query.matches);
    sync();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync);
      return () => query.removeEventListener('change', sync);
    }
    query.addListener(sync);
    return () => query.removeListener(sync);
  }, []);

  const trimmed = note?.trim();
  if (!trimmed) return null;

  const preview = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
  const triggerClassName = cn(
    'inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-medium',
    variant === 'icon' ? 'p-1.5' : 'px-2 py-1',
    className,
  );

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.click();
  };

  const trigger = (
    <span
      role="button"
      tabIndex={0}
      aria-label="Comentario del cliente"
      className={triggerClassName}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleTriggerKeyDown}
    >
      <MessageSquare className={variant === 'icon' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      {variant === 'pill' && <span>Comentario</span>}
    </span>
  );

  if (clickMode) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          {trigger}
        </PopoverTrigger>
        <PopoverContent side="top" className="z-[1000] max-w-[260px] p-3 text-xs leading-relaxed">
          <p className="font-medium text-foreground">Comentario del cliente</p>
          <p className="mt-1 text-muted-foreground">{preview}</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {trigger}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        <p className="font-medium text-foreground">Comentario del cliente</p>
        <p className="mt-1 text-muted-foreground">{preview}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default AppointmentNoteIndicator;
