import { useId, useState } from 'react';
import { ChevronDown, Coffee, Plus, Trash2 } from 'lucide-react';
import type { BreakRange, DayKey, ShopSchedule } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/hooks/useI18n';
import { copyScheduleBreaks, formatScheduleDate, isValidScheduleRange, SCHEDULE_DAYS, SCHEDULE_DAY_LABELS } from '@/lib/scheduleSettings';
import AgendaSectionHeading from './AgendaSectionHeading';
import BreakRangesEditor from './BreakRangesEditor';
import ConfirmScheduleAction from './ConfirmScheduleAction';
import CopyToDaysButton from './CopyToDaysButton';

export default function ScheduleBreaksEditor({ value, onChange, disabled }: {
  value: ShopSchedule;
  onChange: (value: ShopSchedule) => void;
  disabled: boolean;
}) {
  const { t, language } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [openDay, setOpenDay] = useState<DayKey | null>(null);
  const [newDate, setNewDate] = useState('');
  const [visibleDates, setVisibleDates] = useState(12);
  const weekly = SCHEDULE_DAYS.reduce((count, day) => count + (value.breaks?.[day]?.length ?? 0), 0);
  const dated = Object.entries(value.breaksByDate ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const total = weekly + dated.reduce((count, [, ranges]) => count + ranges.length, 0);
  const updateDay = (day: DayKey, ranges: BreakRange[]) => {
    const breaks = Object.fromEntries(SCHEDULE_DAYS.map((key) => [key, value.breaks?.[key] ?? []])) as Record<DayKey, BreakRange[]>;
    onChange({ ...value, breaks: { ...breaks, [day]: ranges } });
  };
  const formatDate = (date: string) => formatScheduleDate(date, language);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <AgendaSectionHeading
          title={t('admin.settings.agenda.breaksTitle')}
          summary={total ? t('admin.settings.agenda.breaksSummary', { count: total, dates: dated.length }) : t('admin.settings.agenda.noBreaks')}
          description={t('admin.settings.agenda.breaksHelp')}
          example={t('admin.settings.agenda.breaksExample')}
          icon={Coffee}
          disabled={disabled}
        />
        <CollapsibleContent className="space-y-5 px-4 pb-4">
          <div className="divide-y border-y">
            {SCHEDULE_DAYS.map((day) => {
              const ranges = value.breaks?.[day] ?? [];
              const label = t(SCHEDULE_DAY_LABELS[day]);
              return (
                <Collapsible key={day} open={openDay === day} onOpenChange={(expanded) => setOpenDay(expanded ? day : null)}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="h-auto min-h-11 w-full justify-between gap-3 whitespace-normal px-0 text-left" disabled={disabled}>
                      <span>{label}</span>
                      <span className="ml-auto flex flex-wrap justify-end gap-x-3 text-xs font-normal tabular-nums text-muted-foreground">
                        {ranges.length ? ranges.map((range, index) => <span key={index}>{range.start} - {range.end}</span>) : t('admin.settings.agenda.noBreaks')}
                      </span>
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pb-4">
                    <BreakRangesEditor ranges={ranges} label={label} disabled={disabled} onChange={(next) => updateDay(day, next)} />
                    {ranges.length > 0 && <CopyToDaysButton day={day} kind="breaks"
                      disabled={disabled || !ranges.every(isValidScheduleRange)}
                      onCopy={(targets) => onChange(copyScheduleBreaks(value, day, targets))} />}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('admin.settings.agenda.specificDates')}</h3>
            {dated.slice(0, visibleDates).map(([date, ranges]) => (
              <div key={date} className="space-y-3 border-b pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">{formatDate(date)}</h4>
                  <ConfirmScheduleAction description={t('admin.settings.agenda.removeDateDescription', { date: formatDate(date) })}
                    onConfirm={() => {
                      const next = { ...value.breaksByDate };
                      delete next[date];
                      onChange({ ...value, breaksByDate: next });
                    }}>
                    <Button type="button" variant="ghost" size="icon" disabled={disabled}
                      aria-label={t('admin.settings.agenda.removeDate', { date: formatDate(date) })}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </ConfirmScheduleAction>
                </div>
                <BreakRangesEditor ranges={ranges} label={formatDate(date)} disabled={disabled}
                  onChange={(next) => onChange({ ...value, breaksByDate: { ...value.breaksByDate, [date]: next } })} />
              </div>
            ))}
            {dated.length > visibleDates && <Button type="button" variant="ghost" size="sm"
              onClick={() => setVisibleDates((count) => count + 12)}>{t('admin.settings.agenda.showMoreDates')}</Button>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={id}>{t('admin.settings.availability.newDate')}</Label>
                <Input id={id} type="date" value={newDate} disabled={disabled} onChange={(event) => setNewDate(event.target.value)} />
              </div>
              <Button type="button" variant="outline" disabled={disabled || !newDate || Boolean(value.breaksByDate?.[newDate])}
                onClick={() => {
                  onChange({ ...value, breaksByDate: { ...value.breaksByDate, [newDate]: [{ start: '13:30', end: '14:00' }] } });
                  setNewDate('');
                }}>
                <Plus aria-hidden="true" />{t('admin.settings.actions.addDate')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
