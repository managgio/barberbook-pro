import { Module } from '@nestjs/common';
import { PrismaHolidayManagementAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-holiday-management.adapter';
import { HOLIDAY_MANAGEMENT_PORT } from '../../contexts/booking/ports/outbound/holiday-management.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { HolidaysService } from './holidays.service';
import { HolidaysController } from './holidays.controller';

@Module({
  imports: [TenancyModule],
  controllers: [HolidaysController],
  providers: [
    HolidaysService,
    PrismaHolidayManagementAdapter,
    {
      provide: HOLIDAY_MANAGEMENT_PORT,
      useExisting: PrismaHolidayManagementAdapter,
    },
  ],
  exports: [HolidaysService],
})
export class HolidaysModule {}
