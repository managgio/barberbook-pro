import { ScheduleManagementPort } from '../../ports/outbound/schedule-management.port';
import { GetBarberScheduleQuery } from '../queries/get-barber-schedule.query';

export class GetBarberScheduleUseCase {
  constructor(private readonly scheduleManagementPort: ScheduleManagementPort) {}

  execute(query: GetBarberScheduleQuery) {
    return this.scheduleManagementPort.getBarberSchedule({
      localId: query.context.localId,
      barberId: query.barberId,
    });
  }
}

