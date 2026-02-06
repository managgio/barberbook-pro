import React from 'react';
import { LoyaltyProgram, LoyaltyProgramProgress } from '@/data/types';
import { useTenant } from '@/context/TenantContext';
import { resolveBrandLogo } from '@/lib/branding';
import { cn } from '@/lib/utils';

type LoyaltyProgressPanelProps = {
  program: LoyaltyProgram;
  progress: LoyaltyProgramProgress;
  variant?: 'full' | 'compact';
  className?: string;
};

const getScopeLabel = (program: LoyaltyProgram) => {
  if (program.scope === 'service') {
    return program.serviceName ? `Servicio: ${program.serviceName}` : 'Servicio específico';
  }
  if (program.scope === 'category') {
    return program.categoryName ? `Categoría: ${program.categoryName}` : 'Categoría de servicios';
  }
  return 'Todos los servicios';
};

const buildMessage = (progress: LoyaltyProgramProgress) => {
  if (progress.totalVisitsAccumulated > 0 && progress.cycleVisits === 0) {
    return 'Has completado una tarjeta. ¡Empieza una nueva!';
  }
  if (progress.isRewardNext) {
    return 'Tu próxima cita será gratis.';
  }
  const remaining = progress.nextFreeIn;
  return `Te faltan ${remaining} ${remaining === 1 ? 'visita' : 'visitas'} para conseguir una gratis.`;
};

const LoyaltyProgressPanel: React.FC<LoyaltyProgressPanelProps> = ({
  program,
  progress,
  variant = 'full',
  className,
}) => {
  const { tenant } = useTenant();
  const logoUrl = resolveBrandLogo(tenant, '/leBlondLogo.png');
  const sizeClass = variant === 'compact' ? 'h-8 w-8' : 'h-10 w-10';
  const imageClass = variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5';
  const stamps = Array.from({ length: Math.max(1, progress.totalVisits) });

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{program.name}</p>
          <span className="text-xs text-muted-foreground">
            {progress.cycleVisits}/{progress.totalVisits}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{getScopeLabel(program)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {stamps.map((_, index) => {
          const isFilled = index < progress.cycleVisits;
          const isNext = index === progress.cycleVisits && progress.cycleVisits < progress.totalVisits;
          return (
            <div
              key={`${program.id}-stamp-${index}`}
              className={cn(
                'relative flex items-center justify-center rounded-full border transition-colors',
                sizeClass,
                isFilled
                  ? 'bg-primary/15 border-primary/50'
                  : isNext
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-muted/40 border-border/70'
              )}
            >
              <img
                src={logoUrl}
                alt={program.name}
                loading="lazy"
                decoding="async"
                width={24}
                height={24}
                className={cn('object-contain', imageClass, isFilled ? 'opacity-40' : 'opacity-70')}
              />
              {isFilled && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="block w-3/4 h-[2px] bg-primary/80 rotate-[-25deg] rounded-full" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {variant === 'full' && (
        <p className="text-xs text-muted-foreground">{buildMessage(progress)}</p>
      )}
      {variant === 'compact' && (
        <p className="text-[11px] text-muted-foreground">{buildMessage(progress)}</p>
      )}
    </div>
  );
};

export default LoyaltyProgressPanel;
