import { Module } from '@nestjs/common';
import { PLATFORM_USAGE_METRICS_PORT } from '../../contexts/platform/ports/outbound/platform-usage-metrics.port';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PrismaPlatformUsageMetricsAdapter } from './adapters/prisma-platform-usage-metrics.adapter';
import { UsageMetricsService } from './usage-metrics.service';
import { ImageKitUsageScheduler } from './imagekit-usage.scheduler';

@Module({
  imports: [PrismaModule, TenancyModule],
  providers: [
    UsageMetricsService,
    PrismaPlatformUsageMetricsAdapter,
    {
      provide: PLATFORM_USAGE_METRICS_PORT,
      useExisting: PrismaPlatformUsageMetricsAdapter,
    },
    ImageKitUsageScheduler,
  ],
  exports: [UsageMetricsService],
})
export class UsageMetricsModule {}
