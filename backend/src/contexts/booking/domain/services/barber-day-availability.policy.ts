import { BookingSchedulePolicy } from '../value-objects/schedule';
import { DateRange } from '../value-objects/date-range';
import {
  computeAvailableSlotsForBarber,
  isDateBlockedByHolidayRanges,
} from './availability-engine';

type BarberDayAvailability = {
  dateOnly: string;
  timezone: string;
  barber:
    | {
        id: string;
        isActive: boolean;
        startDate: Date | null;
        endDate: Date | null;
      }
    | undefined;
  eligible: boolean;
  shopSchedule: BookingSchedulePolicy;
  barberSchedule?: BookingSchedulePolicy;
  generalHolidays: DateRange[];
  barberHolidays: DateRange[];
  appointments: Array<{ startDateTime: Date; durationMinutes?: number | null }>;
  closures: Array<{ startDateTime: Date; endDateTime: Date }>;
  targetDurationMinutes: number;
  slotIntervalMinutes?: number;
};

// Both daily and calendar queries apply the same professional eligibility rules.
export const computeBarberDayAvailability = (
  params: BarberDayAvailability,
): string[] => {
  const { barber, dateOnly } = params;
  if (!barber || !barber.isActive || !params.eligible) return [];
  const startDate = barber.startDate?.toISOString().split('T')[0];
  const endDate = barber.endDate?.toISOString().split('T')[0];
  if ((startDate && dateOnly < startDate) || (endDate && dateOnly > endDate))
    return [];
  if (
    isDateBlockedByHolidayRanges(dateOnly, params.generalHolidays) ||
    isDateBlockedByHolidayRanges(dateOnly, params.barberHolidays)
  )
    return [];

  return computeAvailableSlotsForBarber({
    ...params,
    barberId: barber.id,
    barberSchedule: params.barberSchedule || params.shopSchedule,
  });
};
