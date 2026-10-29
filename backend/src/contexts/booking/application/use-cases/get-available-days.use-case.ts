import { ClockPort } from '../../../../shared/application/clock.port';
import { computeBarberDayAvailability } from '../../domain/services/barber-day-availability.policy';
import { normalizeDateRange } from '../../domain/value-objects/date-range';
import { BarberEligibilityReadPort } from '../../ports/outbound/barber-eligibility-read.port';
import {
  BookingAppointmentSlotRecord,
  BookingAvailabilityRangeReadPort,
} from '../../ports/outbound/booking-availability-read.port';
import { HolidayReadPort } from '../../ports/outbound/holiday-read.port';
import { SchedulePolicyReadPort } from '../../ports/outbound/schedule-read.port';
import { ServiceCatalogReadPort } from '../../ports/outbound/service-read.port';
import { GetAvailableDaysQuery } from '../queries/get-available-days.query';

export class GetAvailableDaysUseCase {
  constructor(
    private readonly availabilityReadPort: BookingAvailabilityRangeReadPort,
    private readonly scheduleReadPort: SchedulePolicyReadPort,
    private readonly holidayReadPort: HolidayReadPort,
    private readonly barberReadPort: BarberEligibilityReadPort,
    private readonly serviceReadPort: ServiceCatalogReadPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: GetAvailableDaysQuery): Promise<string[]> {
    const { localId, timezone } = query.context;
    const barberIds = [...new Set(query.barberIds.filter(Boolean))];
    const serviceIds = [...new Set(query.serviceIds.filter(Boolean))];
    if (barberIds.length === 0 || serviceIds.length === 0) return [];

    const range = {
      localId,
      timezone,
      barberIds,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
    const [
      durations,
      shopSchedule,
      generalHolidaysRaw,
      barbers,
      schedules,
      holidaysRaw,
      appointments,
      closures,
      eligibleGroups,
    ] = await Promise.all([
      Promise.all(
        serviceIds.map((serviceId) =>
          this.serviceReadPort.getServiceDuration({ localId, serviceId }),
        ),
      ),
      this.scheduleReadPort.getShopSchedule({ localId }),
      this.holidayReadPort.getGeneralHolidays({ localId }),
      this.barberReadPort.getBarbers({ localId, barberIds }),
      this.scheduleReadPort.getBarberSchedules({ localId, barberIds }),
      this.holidayReadPort.getBarberHolidaysByBarberIds({ localId, barberIds }),
      this.availabilityReadPort.listAppointmentsForBarbersRange(range),
      this.availabilityReadPort.listClosuresForBarbersRange(range),
      Promise.all(
        serviceIds.map((serviceId) =>
          this.barberReadPort.getEligibleBarberIdsForService({
            localId,
            serviceId,
            barberIds,
          }),
        ),
      ),
    ]);

    const generalHolidays = generalHolidaysRaw.map(normalizeDateRange);
    const eligibleBarbers = barbers.filter(
      (barber) =>
        barber.isActive &&
        barberIds.includes(barber.id) &&
        eligibleGroups.every((ids) => ids.includes(barber.id)),
    );
    const holidays = Object.fromEntries(
      barberIds.map((id) => [
        id,
        (holidaysRaw[id] || []).map(normalizeDateRange),
      ]),
    );
    const targetDurationMinutes = durations.reduce(
      (sum, duration) => sum + duration,
      0,
    );
    // Reuse one formatter and index the range once instead of querying each day.
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateKey = (date: Date) => {
      const parts = dateFormatter.formatToParts(date);
      const part = (type: string) =>
        parts.find((item) => item.type === type)!.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    };
    const now = this.clock.now();
    const today = dateKey(now);
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    const appointmentsByDay = new Map<string, BookingAppointmentSlotRecord[]>();
    for (const appointment of appointments) {
      const key = `${dateKey(appointment.startDateTime)}:${appointment.barberId}`;
      const group = appointmentsByDay.get(key) || [];
      group.push(appointment);
      appointmentsByDay.set(key, group);
    }
    const datedClosures = closures.map((closure) => ({
      ...closure,
      from: dateKey(closure.startDateTime),
      to: dateKey(closure.endDateTime),
    }));

    const availableDays: string[] = [];
    // Increment civil dates in UTC, so DST never skips or repeats a calendar day.
    const cursor = new Date(`${query.dateFrom}T00:00:00Z`);
    for (
      let dateOnly = query.dateFrom;
      dateOnly <= query.dateTo;
      cursor.setUTCDate(cursor.getUTCDate() + 1),
        dateOnly = cursor.toISOString().slice(0, 10)
    ) {
      if (dateOnly < today) continue;
      const available = eligibleBarbers.some((barber) => {
        const slots = computeBarberDayAvailability({
          dateOnly,
          timezone,
          barber,
          eligible: true,
          shopSchedule,
          barberSchedule: schedules[barber.id],
          generalHolidays,
          barberHolidays: holidays[barber.id],
          appointments: (
            appointmentsByDay.get(`${dateOnly}:${barber.id}`) || []
          ).map((appointment) => ({
            startDateTime: appointment.startDateTime,
            durationMinutes: appointment.serviceDurationMinutes,
          })),
          closures: datedClosures.filter(
            (closure) =>
              (closure.barberId === null || closure.barberId === barber.id) &&
              closure.from <= dateOnly &&
              closure.to >= dateOnly,
          ),
          targetDurationMinutes,
          slotIntervalMinutes: query.slotIntervalMinutes,
        });
        return slots.some((slot) => dateOnly > today || slot > currentTime);
      });
      if (available) availableDays.push(dateOnly);
    }
    return availableDays;
  }
}
