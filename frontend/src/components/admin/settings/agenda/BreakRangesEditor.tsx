import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BreakRange } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/hooks/useI18n';
import { isValidScheduleRange } from '@/lib/scheduleSettings';
import ConfirmScheduleAction from './ConfirmScheduleAction';

export default function BreakRangesEditor({ ranges, label, onChange, disabled }: {
  ranges: BreakRange[];
  label: string;
  onChange: (ranges: BreakRange[]) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="space-y-3">
      {ranges.map((range, index) => {
        const invalid = !isValidScheduleRange(range);
        const rangeId = id + '-' + index;
        return (
          <fieldset key={index} className="min-w-0 space-y-2">
            <legend className="sr-only">{t('admin.settings.agenda.breakLabel', { scope: label, count: index + 1 })}</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
              {(['start', 'end'] as const).map((field) => (
                <div key={field} className="min-w-0 space-y-1">
                  <Label htmlFor={rangeId + field} className="text-xs text-muted-foreground">
                    {t(field === 'start' ? 'admin.settings.openingHours.start' : 'admin.settings.openingHours.end')}
                  </Label>
                  <Input id={rangeId + field} type="time" className="min-w-0" value={range[field]} disabled={disabled}
                    aria-invalid={invalid} aria-describedby={invalid ? rangeId + '-error' : undefined}
                    onChange={(event) => onChange(ranges.map((current, position) =>
                      position === index ? { ...current, [field]: event.target.value } : current))} />
                </div>
              ))}
              <ConfirmScheduleAction
                description={t('admin.settings.agenda.removeBreakDescription', { scope: label, start: range.start, end: range.end })}
                onConfirm={() => onChange(ranges.filter((_, position) => position !== index))}>
                <Button type="button" variant="ghost" size="icon" disabled={disabled}
                  aria-label={t('admin.settings.agenda.removeBreak', { scope: label, count: index + 1 })}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </ConfirmScheduleAction>
            </div>
            {invalid && <p id={rangeId + '-error'} role="alert" className="text-sm text-destructive">{t('admin.settings.agenda.invalidRange')}</p>}
          </fieldset>
        );
      })}
      <Button type="button" variant="outline" size="sm" disabled={disabled}
        onClick={() => onChange([...ranges, { start: '13:30', end: '14:00' }])}>
        <Plus aria-hidden="true" />{t('admin.settings.agenda.addBreak')}
      </Button>
    </div>
  );
}
