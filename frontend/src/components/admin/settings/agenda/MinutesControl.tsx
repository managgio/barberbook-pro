import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/hooks/useI18n';
import { isValidScheduleMinutes } from '@/lib/scheduleSettings';

type Props = {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  presets?: boolean;
  inherit?: number;
};

export default function MinutesControl({ label, value, onChange, disabled, presets, inherit }: Props) {
  const { t } = useI18n();
  const id = useId();
  const invalid = !isValidScheduleMinutes(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {presets && (
          <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
            {[0, 5, 10, 15].map((minutes) => (
              <Button key={minutes} type="button" size="sm" variant={(value ?? 0) === minutes ? 'secondary' : 'ghost'}
                aria-pressed={(value ?? 0) === minutes} disabled={disabled} onClick={() => onChange(minutes)}>
                {t('admin.settings.agenda.minutes', { minutes })}
              </Button>
            ))}
          </div>
        )}
        <Input id={id} type="number" min={0} step={1} value={value ?? ''}
          placeholder={inherit === undefined ? '0' : t('admin.settings.agenda.inheritMinutes', { minutes: inherit })}
          className={inherit === undefined ? 'w-24' : 'w-full sm:w-44'} disabled={disabled}
          aria-invalid={invalid} aria-describedby={invalid ? id + '-error' : undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))} />
        {inherit === undefined && <span className="text-sm text-muted-foreground">{t('admin.settings.agenda.minuteUnit')}</span>}
      </div>
      {invalid && <p id={id + '-error'} role="alert" className="text-sm text-destructive">{t('admin.settings.agenda.invalidMinutes')}</p>}
    </div>
  );
}
