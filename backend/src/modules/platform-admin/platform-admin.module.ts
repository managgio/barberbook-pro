import { Module } from '@nestjs/common';
import { PLATFORM_ADMIN_MANAGEMENT_PORT } from '../../contexts/platform/ports/outbound/platform-admin-management.port';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { AuthModule } from '../../auth/auth.module';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaImageKitPlatformAdminManagementAdapter } from './adapters/prisma-imagekit-platform-admin-management.adapter';

@Module({
  imports: [PrismaModule, UsageMetricsModule, ImageKitModule, AuthModule, ObservabilityModule],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminService,
    PlatformAdminGuard,
    PrismaImageKitPlatformAdminManagementAdapter,
    {
      provide: PLATFORM_ADMIN_MANAGEMENT_PORT,
      useExisting: PrismaImageKitPlatformAdminManagementAdapter,
    },
  ],
})
export class PlatformAdminModule {}
