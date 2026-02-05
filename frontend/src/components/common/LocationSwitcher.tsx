import React from 'react';
import { useTenant } from '@/context/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessCopy } from '@/lib/businessCopy';

const LocationSwitcher: React.FC<{ compact?: boolean; className?: string }> = ({ compact, className }) => {
  const { locations, currentLocationId, selectLocation } = useTenant();
  const copy = useBusinessCopy();

  if (locations.length <= 1) {
    return null;
  }

  return (
    <Select value={currentLocationId || undefined} onValueChange={selectLocation}>
      <SelectTrigger className={cn(compact ? 'h-8 w-[170px]' : 'h-9 w-[200px]', className)}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <SelectValue placeholder={`Selecciona ${copy.location.indefiniteSingular}`} />
        </div>
      </SelectTrigger>
      <SelectContent>
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
