import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import {
  PrismaPlatformSettingsManagementAdapter,
  PrismaPlatformSettingsManagementAdapterProvider,
} from './adapters/prisma-platform-settings-management.adapter';

@Module({
  imports: [PrismaModule, TenancyModule],
  controllers: [SettingsController],
  providers: [
    PrismaPlatformSettingsManagementAdapter,
    PrismaPlatformSettingsManagementAdapterProvider,
    SettingsService,
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
