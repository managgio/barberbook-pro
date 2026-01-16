import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { UsageMetricsService } from './usage-metrics.service';
import { ImageKitUsageScheduler } from './imagekit-usage.scheduler';

@Module({
  imports: [PrismaModule, TenancyModule],
  providers: [UsageMetricsService, ImageKitUsageScheduler],
  exports: [UsageMetricsService],
})
export class UsageMetricsModule {}
