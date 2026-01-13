import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsStatusSyncService } from './appointments-status-sync.service';
import { AppointmentsController } from './appointments.controller';
import { HolidaysModule } from '../holidays/holidays.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HolidaysModule, SchedulesModule, NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsStatusSyncService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
