import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { RemoveGeneralHolidayCommand } from '../commands/remove-general-holiday.command';
import { normalizeHolidayRange } from './holiday-range.policy';

export class RemoveGeneralHolidayUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  async execute(command: RemoveGeneralHolidayCommand) {
    const range = normalizeHolidayRange(command.range);
    await this.holidayManagementPort.removeGeneralHoliday({
      localId: command.context.localId,
      start: range.start,
      end: range.end,
    });

    return this.holidayManagementPort.getGeneralHolidays({
      localId: command.context.localId,
    });
  }
}

