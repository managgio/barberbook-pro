import { computeBarberDayAvailability } from '../../domain/services/barber-day-availability.policy';
import { isDateBlockedByHolidayRanges } from '../../domain/services/availability-engine';
import { normalizeDateRange } from '../../domain/value-objects/date-range';
import { BarberEligibilityReadPort } from '../../ports/outbound/barber-eligibility-read.port';
import { BookingAvailabilityReadPort } from '../../ports/outbound/booking-availability-read.port';
import { HolidayReadPort } from '../../ports/outbound/holiday-read.port';
import { SchedulePolicyReadPort } from '../../ports/outbound/schedule-read.port';
import { ServiceCatalogReadPort } from '../../ports/outbound/service-read.port';
import { GetAvailabilityBatchQuery } from '../queries/get-availability-batch.query';

export class GetAvailabilityBatchUseCase {
  constructor(
    private readonly availabilityReadPort: BookingAvailabilityReadPort,
    private readonly schedulePolicyReadPort: SchedulePolicyReadPort,
    private readonly holidayReadPort: HolidayReadPort,
    private readonly barberEligibilityReadPort: BarberEligibilityReadPort,
    private readonly serviceCatalogReadPort: ServiceCatalogReadPort,
  ) {}

  async execute(query: GetAvailabilityBatchQuery): Promise<Record<string, string[]>> {
    const dateOnly = query.date.split('T')[0];
    const localId = query.context.localId;
    const serviceIds = Array.from(new Set(
      [query.serviceId, ...(query.serviceIds || [])].filter((id): id is string => Boolean(id)),
    ));
    const normalizedBarberIds = Array.from(new Set((query.barberIds || []).filter(Boolean)));
    if (normalizedBarberIds.length === 0) return {};

    const emptyResponse = Object.fromEntries(
      normalizedBarberIds.map((barberId) => [barberId, [] as string[]]),
    );

    const [
      targetDuration,
      shopSchedule,
      generalHolidaysRaw,
      barbers,
      barberSchedules,
      barberHolidaysByBarberIdRaw,
      appointments,
      closures,
      eligibleBarberIds,
    ] = await Promise.all([
      serviceIds.length > 0
        ? Promise.all(serviceIds.map((serviceId) =>
            this.serviceCatalogReadPort.getServiceDuration({ localId, serviceId }),
          )).then((durations) => durations.reduce((total, duration) => total + duration, 0))
        : this.serviceCatalogReadPort.getServiceDuration({ localId }),
      this.schedulePolicyReadPort.getShopSchedule({ localId }),
      this.holidayReadPort.getGeneralHolidays({ localId }),
      this.barberEligibilityReadPort.getBarbers({ localId, barberIds: normalizedBarberIds }),
      this.schedulePolicyReadPort.getBarberSchedules({ localId, barberIds: normalizedBarberIds }),
      this.holidayReadPort.getBarberHolidaysByBarberIds({ localId, barberIds: normalizedBarberIds }),
      this.availabilityReadPort.listAppointmentsForBarbersDay({
        localId,
        barberIds: normalizedBarberIds,
        dateOnly,
        appointmentIdToIgnore: query.appointmentIdToIgnore,
      }),
      this.availabilityReadPort.listClosuresForBarbersDay?.({
        localId,
        barberIds: normalizedBarberIds,
        dateOnly,
      }) ?? Promise.resolve([]),
      serviceIds.length > 0
        ? Promise.all(serviceIds.map((serviceId) =>
            this.barberEligibilityReadPort.getEligibleBarberIdsForService({
              localId,
              serviceId,
              barberIds: normalizedBarberIds,
            }),
          )).then((eligibleGroups) => normalizedBarberIds.filter((barberId) =>
            eligibleGroups.every((group) => group.includes(barberId)),
          ))
        : Promise.resolve(normalizedBarberIds),
    ]);

    const generalHolidays = generalHolidaysRaw.map(normalizeDateRange);
    if (isDateBlockedByHolidayRanges(dateOnly, generalHolidays)) {
      return emptyResponse;
    }

    const barberById = new Map(barbers.map((barber) => [barber.id, barber]));
    const appointmentsByBarberId = new Map<string, Array<{ startDateTime: Date; durationMinutes?: number | null }>>();
    appointments.forEach((appointment) => {
      const existing = appointmentsByBarberId.get(appointment.barberId) || [];
      existing.push({
        startDateTime: appointment.startDateTime,
        durationMinutes: appointment.serviceDurationMinutes,
      });
      appointmentsByBarberId.set(appointment.barberId, existing);
    });

    const eligibleSet = new Set(eligibleBarberIds);
    const response: Record<string, string[]> = {};

    normalizedBarberIds.forEach((barberId) => {
      const barberAppointments = appointmentsByBarberId.get(barberId) || [];
      const barberClosures = closures.filter(
        (closure) => closure.barberId === null || closure.barberId === barberId,
      );

      response[barberId] = computeBarberDayAvailability({
        dateOnly,
        timezone: query.context.timezone,
        barber: barberById.get(barberId),
        eligible: eligibleSet.has(barberId),
        generalHolidays,
        barberHolidays: (barberHolidaysByBarberIdRaw[barberId] || []).map(normalizeDateRange),
        barberSchedule: barberSchedules[barberId],
        shopSchedule,
        appointments: barberAppointments,
        closures: barberClosures,
        targetDurationMinutes: targetDuration,
        slotIntervalMinutes: query.slotIntervalMinutes,
      });
    });

    return response;
  }
}
