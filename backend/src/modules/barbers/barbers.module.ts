import { Module } from '@nestjs/common';
import { PrismaBarberDirectoryReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-barber-directory-read.adapter';
import { PrismaBarberEligibilityReadAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-barber-eligibility-read.adapter';
import { PrismaBarberManagementAdapter } from '../../contexts/booking/infrastructure/prisma/prisma-barber-management.adapter';
import { BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT } from '../../contexts/booking/ports/outbound/barber-assignment-policy-read.port';
import { BARBER_ELIGIBILITY_READ_PORT } from '../../contexts/booking/ports/outbound/barber-eligibility-read.port';
import { BOOKING_BARBER_DIRECTORY_READ_PORT } from '../../contexts/booking/ports/outbound/barber-directory-read.port';
import { BOOKING_BARBER_MANAGEMENT_PORT } from '../../contexts/booking/ports/outbound/barber-management.port';
import { BOOKING_BARBER_PHOTO_STORAGE_PORT } from '../../contexts/booking/ports/outbound/barber-photo-storage.port';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { SettingsModule } from '../settings/settings.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ModuleBookingBarberAssignmentPolicyReadAdapter } from './adapters/module-booking-barber-assignment-policy-read.adapter';
import { ModuleBookingBarberPhotoStorageAdapter } from './adapters/module-booking-barber-photo-storage.adapter';
import { BarbersService } from './barbers.service';
import { BarbersController } from './barbers.controller';

@Module({
  imports: [ImageKitModule, SettingsModule, TenancyModule],
  controllers: [BarbersController],
  providers: [
    BarbersService,
    ModuleBookingBarberAssignmentPolicyReadAdapter,
    PrismaBarberDirectoryReadAdapter,
    PrismaBarberEligibilityReadAdapter,
    PrismaBarberManagementAdapter,
    ModuleBookingBarberPhotoStorageAdapter,
    {
      provide: BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT,
      useExisting: ModuleBookingBarberAssignmentPolicyReadAdapter,
    },
    {
      provide: BOOKING_BARBER_DIRECTORY_READ_PORT,
      useExisting: PrismaBarberDirectoryReadAdapter,
    },
    {
      provide: BARBER_ELIGIBILITY_READ_PORT,
      useExisting: PrismaBarberEligibilityReadAdapter,
    },
    {
      provide: BOOKING_BARBER_MANAGEMENT_PORT,
      useExisting: PrismaBarberManagementAdapter,
    },
    {
      provide: BOOKING_BARBER_PHOTO_STORAGE_PORT,
      useExisting: ModuleBookingBarberPhotoStorageAdapter,
    },
  ],
  exports: [BarbersService],
})
export class BarbersModule {}
