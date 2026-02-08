import React from 'react';
import { useTenant } from '@/context/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessCopy } from '@/lib/businessCopy';

const LocationSwitcher: React.FC<{ compact?: boolean; className?: string; showSingleLocationLabel?: boolean }> = ({
  compact,
  className,
  showSingleLocationLabel = false,
}) => {
  const { locations, currentLocationId, selectLocation } = useTenant();
  const copy = useBusinessCopy();
  const currentLocation = locations.find((location) => location.id === currentLocationId) ?? locations[0] ?? null;

  if (locations.length <= 1) {
    if (!showSingleLocationLabel || !currentLocation) {
      return null;
    }

    return (
      <div
        className={cn(
          compact
            ? 'h-7 sm:h-8 w-[162px] sm:w-[190px] text-[11px] sm:text-sm border-border/60 bg-background/55 backdrop-blur-md'
            : 'h-8 sm:h-9 w-[150px] sm:w-[200px] text-xs sm:text-sm',
          'inline-flex items-center rounded-md border border-input bg-background px-2.5 sm:px-3 text-foreground',
          className,
        )}
        title={currentLocation.name}
      >
        <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
        <span className="ml-1.5 sm:ml-2 truncate whitespace-nowrap">{currentLocation.name}</span>
      </div>
    );
  }

  if (!currentLocationId) {
    return null;
  }

  return (
    <Select value={currentLocationId || undefined} onValueChange={selectLocation}>
      <SelectTrigger
        className={cn(
          compact
            ? 'h-7 sm:h-8 w-[162px] sm:w-[190px] text-[11px] sm:text-sm whitespace-nowrap border-border/60 bg-background/55 backdrop-blur-md'
            : 'h-8 sm:h-9 w-[150px] sm:w-[200px] text-xs sm:text-sm',
          className,
        )}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          <SelectValue placeholder={`Selecciona ${copy.location.indefiniteSingular}`} />
        </div>
      </SelectTrigger>
      <SelectContent className={compact ? 'border-border/60 bg-background/75 backdrop-blur-xl' : undefined}>
        {locations.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LocationSwitcher;
