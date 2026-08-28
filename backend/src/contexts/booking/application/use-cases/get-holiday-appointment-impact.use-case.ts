import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { GetHolidayAppointmentImpactQuery } from '../queries/get-holiday-appointment-impact.query';
import { normalizeHolidayRange } from './holiday-range.policy';

export class GetHolidayAppointmentImpactUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  execute(query: GetHolidayAppointmentImpactQuery) {
    const range = normalizeHolidayRange(query.range);
    return this.holidayManagementPort.getAppointmentImpact({
      localId: query.context.localId,
      timezone: query.context.timezone,
      start: range.start,
      end: range.end,
      barberId: query.barberId,
    });
  }
}
