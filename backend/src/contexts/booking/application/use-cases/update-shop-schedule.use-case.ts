import { ScheduleManagementPort } from '../../ports/outbound/schedule-management.port';
import { UpdateShopScheduleCommand } from '../commands/update-shop-schedule.command';

export class UpdateShopScheduleUseCase {
  constructor(private readonly scheduleManagementPort: ScheduleManagementPort) {}

  execute(command: UpdateShopScheduleCommand) {
    return this.scheduleManagementPort.updateShopSchedule({
      localId: command.context.localId,
      schedule: command.schedule,
    });
  }
}

