import { ScheduleManagementPort } from '../../ports/outbound/schedule-management.port';
import { UpdateBarberScheduleCommand } from '../commands/update-barber-schedule.command';

export class UpdateBarberScheduleUseCase {
  constructor(private readonly scheduleManagementPort: ScheduleManagementPort) {}

  execute(command: UpdateBarberScheduleCommand) {
    return this.scheduleManagementPort.updateBarberSchedule({
      localId: command.context.localId,
      barberId: command.barberId,
      schedule: command.schedule,
    });
  }
}

