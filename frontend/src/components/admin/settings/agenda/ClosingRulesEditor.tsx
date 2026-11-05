import { useId, useState } from 'react';
import { Clock3, Plus, Trash2 } from 'lucide-react';
import type { DayKey, ShopSchedule } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/hooks/useI18n';
import { formatScheduleDate, SCHEDULE_DAYS, SCHEDULE_DAY_LABELS } from '@/lib/scheduleSettings';
import AgendaSectionHeading from './AgendaSectionHeading';
import ConfirmScheduleAction from './ConfirmScheduleAction';
import MinutesControl from './MinutesControl';

export default function ClosingRulesEditor({ value, onChange, disabled }: {
  value: ShopSchedule;
  onChange: (next: ShopSchedule) => void;
  disabled: boolean;
}) {
  const { t, language } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('monday');
  const [date, setDate] = useState('');
  const [visibleDates, setVisibleDates] = useState(12);
  const days = SCHEDULE_DAYS.filter((day) => value.endOverflowByDay?.[day] !== undefined);
  const availableDays = SCHEDULE_DAYS.filter((day) => !days.includes(day));
  const target = availableDays.includes(scope as DayKey) ? scope : 'date';
  const dates = Object.entries(value.endOverflowByDate ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const count = days.length + dates.length;
  const formatDate = (key: string) => formatScheduleDate(key, language);
  const updateDay = (day: DayKey, minutes?: number) => {
    const next = { ...value.endOverflowByDay };
    if (minutes === undefined) delete next[day];
    else next[day] = minutes;
    onChange({ ...value, endOverflowByDay: next });
  };
  const updateDate = (key: string, minutes?: number) => {
    const next = { ...value.endOverflowByDate };
    if (minutes === undefined) delete next[key];
    else next[key] = minutes;
    onChange({ ...value, endOverflowByDate: next });
  };
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <AgendaSectionHeading
          title={t('admin.settings.agenda.closingTitle')}
          summary={t('admin.settings.agenda.closingSummary', { minutes: value.endOverflowMinutes ?? 0 })
            + ' · ' + (count ? t('admin.settings.agenda.exceptionCount', { count }) : t('admin.settings.agenda.noExceptions'))}
          description={t('admin.settings.agenda.closingHelp')}
          example={t('admin.settings.agenda.closingExample')}
          icon={Clock3}
          disabled={disabled}
        />
        <CollapsibleContent className="space-y-5 px-4 pb-4">
          <div className="space-y-2">
            <MinutesControl label={t('admin.settings.agenda.closingMargin')} value={value.endOverflowMinutes}
              onChange={(minutes) => onChange({ ...value, endOverflowMinutes: minutes })} disabled={disabled} presets />
            <p className="text-sm text-muted-foreground">{t('admin.settings.availability.endOverflowHint')}</p>
          </div>
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">{t('admin.settings.agenda.exceptions')}</h3>
            <p className="text-xs text-muted-foreground">{t('admin.settings.availability.tolerance.priorityHint')}</p>
            {days.map((day) => (
              <div key={day} className="flex items-end justify-between gap-2">
                <MinutesControl label={t(SCHEDULE_DAY_LABELS[day])} value={value.endOverflowByDay?.[day]}
                  onChange={(minutes) => updateDay(day, minutes)} disabled={disabled} inherit={value.endOverflowMinutes ?? 0} />
                <ConfirmScheduleAction description={t('admin.settings.agenda.removeExceptionDescription', { scope: t(SCHEDULE_DAY_LABELS[day]) })}
                  onConfirm={() => updateDay(day)}>
                  <Button type="button" size="icon" variant="ghost" disabled={disabled}
                    aria-label={t('admin.settings.agenda.removeException', { scope: t(SCHEDULE_DAY_LABELS[day]) })}><Trash2 aria-hidden="true" /></Button>
                </ConfirmScheduleAction>
              </div>
            ))}
            {dates.slice(0, visibleDates).map(([key, minutes]) => (
              <div key={key} className="flex items-end justify-between gap-2">
                <MinutesControl label={formatDate(key)} value={minutes} onChange={(next) => updateDate(key, next)}
                  disabled={disabled} inherit={value.endOverflowMinutes ?? 0} />
                <ConfirmScheduleAction description={t('admin.settings.agenda.removeExceptionDescription', { scope: formatDate(key) })}
                  onConfirm={() => updateDate(key)}>
                  <Button type="button" size="icon" variant="ghost" disabled={disabled}
                    aria-label={t('admin.settings.agenda.removeException', { scope: formatDate(key) })}><Trash2 aria-hidden="true" /></Button>
                </ConfirmScheduleAction>
              </div>
            ))}
            {dates.length > visibleDates && <Button type="button" variant="ghost" size="sm"
              onClick={() => setVisibleDates((current) => current + 12)}>{t('admin.settings.agenda.showMoreDates')}</Button>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={id + '-scope'}>{t('admin.settings.agenda.exceptionDay')}</Label>
                <Select value={target} onValueChange={setScope} disabled={disabled}>
                  <SelectTrigger id={id + '-scope'}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableDays.map((day) => <SelectItem key={day} value={day}>{t(SCHEDULE_DAY_LABELS[day])}</SelectItem>)}
                    <SelectItem value="date">{t('admin.settings.agenda.specificDate')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {target === 'date' && <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={id + '-date'}>{t('admin.settings.availability.newDate')}</Label>
                <Input id={id + '-date'} type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={disabled} />
              </div>}
              <Button type="button" variant="outline"
                disabled={disabled || (target === 'date' && (!date || value.endOverflowByDate?.[date] !== undefined))}
                onClick={() => {
                  if (target === 'date') { updateDate(date, value.endOverflowMinutes ?? 0); setDate(''); }
                  else updateDay(target as DayKey, value.endOverflowMinutes ?? 0);
                }}>
                <Plus aria-hidden="true" />{t('admin.settings.agenda.addException')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
