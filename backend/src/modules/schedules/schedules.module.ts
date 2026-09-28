import { Module } from '@nestjs/common';
import { PrismaScheduleManagementAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-schedule-management.adapter';
import { SCHEDULE_MANAGEMENT_PORT } from '../../contexts/booking/ports/outbound/schedule-management.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { PrismaExtraordinaryOpeningManagementAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-extraordinary-opening-management.adapter';
import { EXTRAORDINARY_OPENING_MANAGEMENT_PORT } from '../../contexts/booking/ports/outbound/extraordinary-opening-management.port';

@Module({
  imports: [TenancyModule],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    PrismaScheduleManagementAdapter,
    PrismaExtraordinaryOpeningManagementAdapter,
    {
      provide: SCHEDULE_MANAGEMENT_PORT,
      useExisting: PrismaScheduleManagementAdapter,
    },
    {
      provide: EXTRAORDINARY_OPENING_MANAGEMENT_PORT,
      useExisting: PrismaExtraordinaryOpeningManagementAdapter,
    },
  ],
  exports: [SchedulesService],
})
export class SchedulesModule {}
