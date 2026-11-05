import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { DayKey } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/hooks/useI18n';
import { SCHEDULE_DAYS, SCHEDULE_DAY_LABELS } from '@/lib/scheduleSettings';

export default function CopyToDaysButton({ day, kind, disabled, onCopy }: {
  day: DayKey;
  kind: 'hours' | 'breaks';
  disabled?: boolean;
  onCopy: (days: DayKey[]) => void;
}) {
  const { t } = useI18n();
  const [days, setDays] = useState<DayKey[]>([]);
  const dayLabel = t(SCHEDULE_DAY_LABELS[day]);
  return (
    <AlertDialog onOpenChange={() => setDays([])}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <Copy aria-hidden="true" />{t('admin.settings.agenda.copyToDays')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{kind === 'hours'
            ? t('admin.settings.agenda.copyHoursTitle', { day: dayLabel })
            : t('admin.settings.agenda.copyBreaksTitle', { day: dayLabel })}</AlertDialogTitle>
          <AlertDialogDescription>{kind === 'hours'
            ? t('admin.settings.agenda.copyHoursDescription')
            : t('admin.settings.agenda.copyBreaksDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <Button type="button" size="sm" variant="ghost" className="justify-self-start"
          onClick={() => setDays(SCHEDULE_DAYS.filter((candidate) => candidate !== day))}>
          {t('admin.settings.actions.copyToWeek')}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {SCHEDULE_DAYS.filter((candidate) => candidate !== day).map((candidate) => (
            <label key={candidate} className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox checked={days.includes(candidate)} onCheckedChange={(checked) => setDays((current) =>
                checked === true ? [...current, candidate] : current.filter((value) => value !== candidate))} />
              {t(SCHEDULE_DAY_LABELS[candidate])}
            </label>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('admin.settings.extraordinary.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={!days.length} onClick={() => onCopy(days)}>
            {t('admin.settings.agenda.confirmCopy', { count: days.length })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
