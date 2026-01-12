import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  const trimmed = note?.trim();
  if (!trimmed) return null;

  const preview = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-medium',
            variant === 'icon' ? 'p-1.5' : 'px-2 py-1',
            className,
          )}
        >
          <MessageSquare className={variant === 'icon' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
          {variant === 'pill' && <span>Comentario</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        <p className="font-medium text-foreground">Comentario del cliente</p>
        <p className="mt-1 text-muted-foreground">{preview}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default AppointmentNoteIndicator;
