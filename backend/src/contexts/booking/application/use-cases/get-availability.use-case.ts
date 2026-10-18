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
import { GetAvailabilityQuery } from '../queries/get-availability.query';

export class GetAvailabilityUseCase {
  constructor(
    private readonly availabilityReadPort: BookingAvailabilityReadPort,
    private readonly schedulePolicyReadPort: SchedulePolicyReadPort,
    private readonly holidayReadPort: HolidayReadPort,
    private readonly barberEligibilityReadPort: BarberEligibilityReadPort,
    private readonly serviceCatalogReadPort: ServiceCatalogReadPort,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<string[]> {
    const dateOnly = query.date.split('T')[0];
    const localId = query.context.localId;
    const serviceIds = Array.from(new Set(
      [query.serviceId, ...(query.serviceIds || [])].filter((id): id is string => Boolean(id)),
    ));

    const barber = await this.barberEligibilityReadPort.getBarber({ localId, barberId: query.barberId });
    if (!barber || barber.isActive === false) return [];

    if (serviceIds.length > 0) {
      const compatibility = await Promise.all(
        serviceIds.map((serviceId) => this.barberEligibilityReadPort.isBarberAllowedForService({
          localId,
          barberId: query.barberId,
          serviceId,
        })),
      );
      if (compatibility.some((allowed) => !allowed)) return [];
    }

    const startDate = barber.startDate ? barber.startDate.toISOString().split('T')[0] : null;
    const endDate = barber.endDate ? barber.endDate.toISOString().split('T')[0] : null;
    if (startDate && dateOnly < startDate) return [];
    if (endDate && dateOnly > endDate) return [];

    const [barberSchedule, shopSchedule, generalHolidaysRaw, barberHolidaysRaw, targetDuration, appointments, closures] =
      await Promise.all([
        this.schedulePolicyReadPort.getBarberSchedule({ localId, barberId: query.barberId }),
        this.schedulePolicyReadPort.getShopSchedule({ localId }),
        this.holidayReadPort.getGeneralHolidays({ localId }),
        this.holidayReadPort.getBarberHolidays({ localId, barberId: query.barberId }),
        serviceIds.length > 0
          ? Promise.all(serviceIds.map((serviceId) =>
              this.serviceCatalogReadPort.getServiceDuration({ localId, serviceId }),
            )).then((durations) => durations.reduce((total, duration) => total + duration, 0))
          : this.serviceCatalogReadPort.getServiceDuration({ localId }),
        this.availabilityReadPort.listAppointmentsForBarberDay({
          localId,
          barberId: query.barberId,
          dateOnly,
          appointmentIdToIgnore: query.appointmentIdToIgnore,
        }),
        this.availabilityReadPort.listClosuresForBarberDay?.({
          localId,
          barberId: query.barberId,
          dateOnly,
        }) ?? Promise.resolve([]),
      ]);

    const generalHolidays = generalHolidaysRaw.map(normalizeDateRange);
    const barberHolidays = barberHolidaysRaw.map(normalizeDateRange);

    if (isDateBlockedByHolidayRanges(dateOnly, generalHolidays)) return [];
    if (isDateBlockedByHolidayRanges(dateOnly, barberHolidays)) return [];

    return computeAvailableSlotsForBarber({
      dateOnly,
      timezone: query.context.timezone,
      barberId: query.barberId,
      barberSchedule,
      shopSchedule,
      appointments: appointments.map((appointment) => ({
        startDateTime: appointment.startDateTime,
        durationMinutes: appointment.serviceDurationMinutes,
      })),
      closures,
      targetDurationMinutes: targetDuration,
      slotIntervalMinutes: query.slotIntervalMinutes,
    });
  }
}
