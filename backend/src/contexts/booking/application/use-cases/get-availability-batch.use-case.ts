import {
  computeAvailableSlotsForBarber,
  isDateBlockedByHolidayRanges,
} from '../../domain/services/availability-engine';
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
      eligibleBarberIds,
    ] = await Promise.all([
      this.serviceCatalogReadPort.getServiceDuration({ localId, serviceId: query.serviceId }),
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
      query.serviceId
        ? this.barberEligibilityReadPort.getEligibleBarberIdsForService({
            localId,
            serviceId: query.serviceId,
            barberIds: normalizedBarberIds,
          })
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
      const barber = barberById.get(barberId);
      if (!barber || barber.isActive === false) {
        response[barberId] = [];
        return;
      }

      if (query.serviceId && !eligibleSet.has(barberId)) {
        response[barberId] = [];
        return;
      }

      const startDate = barber.startDate ? barber.startDate.toISOString().split('T')[0] : null;
      const endDate = barber.endDate ? barber.endDate.toISOString().split('T')[0] : null;
      if ((startDate && dateOnly < startDate) || (endDate && dateOnly > endDate)) {
        response[barberId] = [];
        return;
      }

      const barberHolidays = (barberHolidaysByBarberIdRaw[barberId] || []).map(normalizeDateRange);
      if (isDateBlockedByHolidayRanges(dateOnly, barberHolidays)) {
        response[barberId] = [];
        return;
      }

      const barberSchedule = barberSchedules[barberId] || shopSchedule;
      const barberAppointments = appointmentsByBarberId.get(barberId) || [];

      response[barberId] = computeAvailableSlotsForBarber({
        dateOnly,
        timezone: query.context.timezone,
        barberSchedule,
        shopSchedule,
        appointments: barberAppointments,
        targetDurationMinutes: targetDuration,
        slotIntervalMinutes: query.slotIntervalMinutes,
      });
    });

    return response;
  }
}
