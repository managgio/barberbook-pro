import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { GetBarberHolidaysQuery } from '../queries/get-barber-holidays.query';

export class GetBarberHolidaysUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  execute(query: GetBarberHolidaysQuery) {
    return this.holidayManagementPort.getBarberHolidays({
      localId: query.context.localId,
      barberId: query.barberId,
    });
  }
}

