import {
  addMonths,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useBookingAvailableDays } from './useBookingAvailableDays';

type Props = {
  selectedDate: Date;
  visibleMonth: Date;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
  availability: ReturnType<typeof useBookingAvailableDays>;
};

const BookingAvailabilityCalendar = ({
  selectedDate,
  visibleMonth,
  onMonthChange,
  onSelectDate,
  availability,
}: Props) => {
  const { t, language } = useI18n();
  const dateLocale = resolveDateLocale(language);
  const today = startOfDay(new Date());
  const { calendarDays } = availability;
  const noAvailableDays =
    availability.isReady &&
    !calendarDays.some(
      (date) =>
        isSameMonth(date, visibleMonth) &&
        availability.availableDays.has(format(date, 'yyyy-MM-dd')),
    );
  return (
    <div className="min-w-0 max-w-full space-y-2 sm:space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <p className="shrink-0 text-xs font-medium text-muted-foreground sm:text-sm">
          {t('bookingWizard.step1.selectDay')}
        </p>
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => onMonthChange(subMonths(visibleMonth, 1))}
            aria-label={t('bookingWizard.step1.previousMonth')}
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          <span className="min-w-0 truncate text-xs font-semibold text-foreground capitalize sm:text-sm">
            {format(visibleMonth, 'MMMM yyyy', { locale: dateLocale })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => onMonthChange(addMonths(visibleMonth, 1))}
            aria-label={t('bookingWizard.step1.nextMonth')}
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 max-w-full grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]">
        {[
          t('bookingWizard.weekday.mondayShort'),
          t('bookingWizard.weekday.tuesdayShort'),
          t('bookingWizard.weekday.wednesdayShort'),
          t('bookingWizard.weekday.thursdayShort'),
          t('bookingWizard.weekday.fridayShort'),
          t('bookingWizard.weekday.saturdayShort'),
          t('bookingWizard.weekday.sundayShort'),
        ].map((day) => (
          <span key={day} className="min-w-0 truncate">
            {day}
          </span>
        ))}
      </div>
      <div
        className="grid min-w-0 max-w-full grid-cols-7 gap-1"
        aria-busy={availability.isLoading}
      >
        {calendarDays.map((date) => {
          const isDisabled =
            isBefore(date, today) ||
            !availability.isReady ||
            !availability.availableDays.has(format(date, 'yyyy-MM-dd'));
          const isSelected = !isDisabled && isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, visibleMonth);
          return (
            <button
              type="button"
              key={date.toISOString()}
              disabled={isDisabled}
              aria-label={format(date, 'PPPP', { locale: dateLocale })}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(startOfDay(date))}
              className={cn(
                'flex min-h-[44px] min-w-0 max-w-full flex-col items-center justify-center overflow-hidden rounded-lg border px-0 py-1 text-center text-[11px] transition-all sm:min-h-[52px] sm:text-xs',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                  : isDisabled
                    ? 'bg-muted text-muted-foreground border-border/50 cursor-not-allowed opacity-60'
                    : 'bg-card border-border hover:border-primary/40',
                !isCurrentMonth && 'opacity-50',
              )}
            >
              <span className="text-[10px] uppercase">
                {format(date, 'EEE', { locale: dateLocale })}
              </span>
              <span className="text-sm sm:text-base font-semibold leading-none mt-0.5">
                {format(date, 'd')}
              </span>
              <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">
                {format(date, 'MMM', { locale: dateLocale })}
              </span>
            </button>
          );
        })}
      </div>
      {(availability.isLoading || availability.isError || noAvailableDays) && (
        <div role="status" aria-live="polite">
          {availability.isLoading && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              {t('bookingWizard.step1.loadingDays')}
            </p>
          )}
          {availability.isError && !availability.isLoading && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>{t('bookingWizard.step1.daysError')}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void availability.refetch()}
              >
                {t('bookingWizard.toast.genericRetry')}
              </Button>
            </div>
          )}
          {noAvailableDays && (
            <p className="text-xs text-muted-foreground">
              {t('bookingWizard.step1.noAvailableDays')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingAvailabilityCalendar;
