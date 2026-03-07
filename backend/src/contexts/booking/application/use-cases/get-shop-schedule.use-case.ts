import { ScheduleManagementPort } from '../../ports/outbound/schedule-management.port';
import { GetShopScheduleQuery } from '../queries/get-shop-schedule.query';

export class GetShopScheduleUseCase {
  constructor(private readonly scheduleManagementPort: ScheduleManagementPort) {}

  execute(query: GetShopScheduleQuery) {
    return this.scheduleManagementPort.getShopSchedule({
      localId: query.context.localId,
    });
  }
}

