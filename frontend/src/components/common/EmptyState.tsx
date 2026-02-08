import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  compactMobile?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  compactMobile = false,
  action,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 text-center animate-fade-in ${
        compactMobile ? 'py-8 sm:py-16' : 'py-16'
      }`}
    >
      <div className={`${compactMobile ? 'w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-6' : 'w-16 h-16 mb-6'} rounded-full bg-secondary flex items-center justify-center`}>
        <Icon className={`${compactMobile ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-8 h-8'} text-muted-foreground`} />
      </div>
      <h3 className={`${compactMobile ? 'text-sm sm:text-lg mb-1.5 sm:mb-2' : 'text-lg mb-2'} font-semibold text-foreground`}>
        {title}
      </h3>
      <p className={`${compactMobile ? 'text-xs sm:text-base mb-4 sm:mb-6' : 'mb-6'} text-muted-foreground max-w-sm`}>
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} className={compactMobile ? 'h-8 sm:h-10 text-xs sm:text-sm' : undefined}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
