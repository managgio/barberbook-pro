import { HolidayManagementPort } from '../../ports/outbound/holiday-management.port';
import { RemoveBarberHolidayCommand } from '../commands/remove-barber-holiday.command';
import { normalizeHolidayRange } from './holiday-range.policy';

export class RemoveBarberHolidayUseCase {
  constructor(private readonly holidayManagementPort: HolidayManagementPort) {}

  async execute(command: RemoveBarberHolidayCommand) {
    const range = normalizeHolidayRange(command.range);
    await this.holidayManagementPort.removeBarberHoliday({
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

