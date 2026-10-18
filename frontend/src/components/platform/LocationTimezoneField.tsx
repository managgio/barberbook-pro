import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_LOCATION_TIMEZONE,
  LOCATION_TIMEZONE_OPTIONS,
} from '@/lib/locationTimezone';

const LocationTimezoneField: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ id, value, onChange }) => {
  const helpId = `${id}-help`;
  const listId = `${id}-options`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Zona horaria</Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={DEFAULT_LOCATION_TIMEZONE}
        autoComplete="off"
        aria-describedby={helpId}
      />
      <datalist id={listId}>
        {LOCATION_TIMEZONE_OPTIONS.map((timezone) => (
          <option key={timezone} value={timezone} />
        ))}
      </datalist>
      <p id={helpId} className="text-xs text-muted-foreground">
        Selecciona una zona IANA. Se usa para citas, recordatorios y procesos automáticos del local.
      </p>
    </div>
  );
};

export default LocationTimezoneField;
