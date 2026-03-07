import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { GetGeneralHolidaysQuery } from '../queries/get-general-holidays.query';

export class GetGeneralHolidaysUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  execute(query: GetGeneralHolidaysQuery) {
    return this.holidayManagementPort.getGeneralHolidays({
      localId: query.context.localId,
    });
  }
}

