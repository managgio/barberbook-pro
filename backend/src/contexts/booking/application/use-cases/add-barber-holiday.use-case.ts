import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { AddBarberHolidayCommand } from '../commands/add-barber-holiday.command';
import { normalizeHolidayRange } from './holiday-range.policy';

export class AddBarberHolidayUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  async execute(command: AddBarberHolidayCommand) {
    const range = normalizeHolidayRange(command.range);
    await this.holidayManagementPort.addBarberHolidayIfMissing({
      localId: command.context.localId,
      barberId: command.barberId,
      start: range.start,
      end: range.end,
    });

    return this.holidayManagementPort.getBarberHolidays({
      localId: command.context.localId,
      barberId: command.barberId,
    });
  }
}

