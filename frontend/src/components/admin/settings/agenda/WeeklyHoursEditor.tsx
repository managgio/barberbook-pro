import { useId, useState } from 'react';
import { ChevronDown, Clock3 } from 'lucide-react';
import type { DayKey, DaySchedule, ShopSchedule } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/hooks/useI18n';
import { useBusinessCopy } from '@/lib/businessCopy';
import { copyScheduleDays, isValidScheduleDay, SCHEDULE_DAYS, SCHEDULE_DAY_LABELS, SCHEDULE_SHIFTS, setScheduleDayOpen } from '@/lib/scheduleSettings';
import CopyToDaysButton from './CopyToDaysButton';

export default function WeeklyHoursEditor({ value, onChange, disabled }: {
  value: ShopSchedule;
  onChange: (next: ShopSchedule) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const copy = useBusinessCopy();
  const id = useId();
  const [openDay, setOpenDay] = useState<DayKey | null>(null);
  const updateDay = (day: DayKey, next: DaySchedule) => onChange({ ...value, [day]: next });
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />{t('admin.settings.agenda.weekTitle')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('admin.settings.openingHours.description', {
          staffFromWithDefinitePlural: copy.staff.fromWithDefinitePlural,
        })}</p>
      </CardHeader>
      <div className="divide-y">
        {SCHEDULE_DAYS.map((day) => {
          const entry = value[day];
          const name = t(SCHEDULE_DAY_LABELS[day]);
          const dayId = id + '-' + day;
          const invalid = !isValidScheduleDay(entry);
          return (
            <Collapsible key={day} open={openDay === day} onOpenChange={(open) => setOpenDay(open ? day : null)}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" disabled={disabled} aria-describedby={dayId + '-summary'}
                  className="h-auto min-h-14 w-full justify-start gap-3 whitespace-normal rounded-none px-4 py-3 text-left">
                  <span className="w-24 shrink-0">{name}</span>
                  <span id={dayId + '-summary'} className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-sm font-normal tabular-nums">
                    {entry.closed ? <span className="text-muted-foreground">{t('admin.settings.openingHours.closed')}</span>
                      : SCHEDULE_SHIFTS.filter((shift) => entry[shift].enabled).map((shift) => (
                        <span key={shift} className="whitespace-nowrap">{entry[shift].start} - {entry[shift].end}</span>
                      ))}
                    {invalid && <span className="text-destructive">{t('admin.settings.agenda.review')}</span>}
                  </span>
                  <span className="sr-only">{t('admin.common.edit')}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 bg-muted/20 px-4 pb-4 pt-1">
                <div className="flex min-h-10 items-center justify-between gap-3">
                  <Label htmlFor={dayId + '-open'}>{t('admin.settings.agenda.dayOpen', { day: name })}</Label>
                  <Switch id={dayId + '-open'} checked={!entry.closed} disabled={disabled}
                    onCheckedChange={(open) => updateDay(day, setScheduleDayOpen(entry, open))} />
                </div>
                {!entry.closed && SCHEDULE_SHIFTS.map((shift) => (
                  <div key={shift} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <label className="flex min-h-10 items-center gap-2 text-sm">
                      <Switch checked={entry[shift].enabled} disabled={disabled}
                        aria-label={t(shift === 'morning' ? 'admin.settings.agenda.morningForDay' : 'admin.settings.agenda.afternoonForDay', { day: name })}
                        onCheckedChange={(enabled) => {
                          const updated = { ...entry, [shift]: { ...entry[shift], enabled } };
                          updateDay(day, { ...updated, closed: !updated.morning.enabled && !updated.afternoon.enabled });
                        }} />
                      {t(shift === 'morning' ? 'admin.settings.agenda.morning' : 'admin.settings.agenda.afternoon')}
                    </label>
                    <div className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1">
                      {(['start', 'end'] as const).map((field) => (
                        <div key={field} className="min-w-0 space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={dayId + '-' + shift + '-' + field}>
                            {t(field === 'start' ? 'admin.settings.openingHours.start' : 'admin.settings.openingHours.end')}
                            <span className="sr-only">{' ' + name + ' ' + t(shift === 'morning' ? 'admin.settings.agenda.morning' : 'admin.settings.agenda.afternoon')}</span>
                          </Label>
                          <Input id={dayId + '-' + shift + '-' + field} type="time" value={entry[shift][field]}
                            disabled={disabled || !entry[shift].enabled} className="min-w-0" aria-invalid={invalid}
                            aria-describedby={invalid ? dayId + '-error' : undefined}
                            onChange={(event) => updateDay(day, { ...entry, [shift]: { ...entry[shift], [field]: event.target.value } })} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {invalid && <p id={dayId + '-error'} role="alert" className="text-sm text-destructive">{t('admin.settings.agenda.invalidHours')}</p>}
                <CopyToDaysButton day={day} kind="hours" disabled={disabled || invalid}
                  onCopy={(targets) => onChange(copyScheduleDays(value, day, targets))} />
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </Card>
  );
}
