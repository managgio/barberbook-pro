import React from 'react';
import { LoyaltyProgram, LoyaltyProgramProgress } from '@/data/types';
import { useTenant } from '@/context/TenantContext';
import { resolveBrandLogo } from '@/lib/branding';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';

type LoyaltyProgressPanelProps = {
  program: LoyaltyProgram;
  progress: LoyaltyProgramProgress;
  variant?: 'full' | 'compact';
  className?: string;
};

const LoyaltyProgressPanel: React.FC<LoyaltyProgressPanelProps> = ({
  program,
  progress,
  variant = 'full',
  className,
}) => {
  const { tenant } = useTenant();
  const { t } = useI18n();
  const logoUrl = resolveBrandLogo(tenant, '/leBlondLogo.png');
  const sizeClass = variant === 'compact' ? 'h-8 w-8' : 'h-10 w-10';
  const imageClass = variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5';
  const stamps = Array.from({ length: Math.max(1, progress.totalVisits) });
  const getScopeLabel = () => {
    if (program.scope === 'service') {
      return program.serviceName
        ? t('loyalty.scope.service', { serviceName: program.serviceName })
        : t('loyalty.scope.serviceFallback');
    }
    if (program.scope === 'category') {
      return program.categoryName
        ? t('loyalty.scope.category', { categoryName: program.categoryName })
        : t('loyalty.scope.categoryFallback');
    }
    return t('loyalty.scope.allServices');
  };
  const buildMessage = () => {
    if (progress.totalVisitsAccumulated > 0 && progress.cycleVisits === 0) {
      return t('loyalty.message.cardCompleted');
    }
    if (progress.isRewardNext) {
      return t('loyalty.message.nextIsFree');
    }
    return t('loyalty.message.remainingVisits', { count: progress.nextFreeIn });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{program.name}</p>
          <span className="text-xs text-muted-foreground">
            {progress.cycleVisits}/{progress.totalVisits}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{getScopeLabel()}</p>
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
        <p className="text-xs text-muted-foreground">{buildMessage()}</p>
      )}
      {variant === 'compact' && (
        <p className="text-[11px] text-muted-foreground">{buildMessage()}</p>
      )}
    </div>
  );
};

export default LoyaltyProgressPanel;
