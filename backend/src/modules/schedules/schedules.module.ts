import { Module } from '@nestjs/common';
import { PrismaScheduleManagementAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-schedule-management.adapter';
import { SCHEDULE_MANAGEMENT_PORT } from '../../contexts/booking/ports/outbound/schedule-management.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [TenancyModule],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    PrismaScheduleManagementAdapter,
    {
      provide: SCHEDULE_MANAGEMENT_PORT,
      useExisting: PrismaScheduleManagementAdapter,
    },
  ],
  exports: [SchedulesService],
})
export class SchedulesModule {}
