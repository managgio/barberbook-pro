import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { AddGeneralHolidayCommand } from '../commands/add-general-holiday.command';
import { normalizeHolidayRange } from './holiday-range.policy';

export class AddGeneralHolidayUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  async execute(command: AddGeneralHolidayCommand) {
    const range = normalizeHolidayRange(command.range);
    await this.holidayManagementPort.addGeneralHolidayIfMissing({
      localId: command.context.localId,
      start: range.start,
      end: range.end,
    });

    return this.holidayManagementPort.getGeneralHolidays({
      localId: command.context.localId,
    });
  }
}

