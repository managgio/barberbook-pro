import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';

@Module({
  imports: [PrismaModule, UsageMetricsModule, ImageKitModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
