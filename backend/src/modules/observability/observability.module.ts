import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PLATFORM_OBSERVABILITY_PORT } from '../../contexts/platform/ports/outbound/platform-observability.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { InMemoryPrismaPlatformObservabilityAdapter } from './adapters/in-memory-prisma-platform-observability.adapter';
import { ApiMetricsInterceptor } from './api-metrics.interceptor';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [TenancyModule],
  controllers: [ObservabilityController],
  providers: [
    ObservabilityService,
    InMemoryPrismaPlatformObservabilityAdapter,
    {
      provide: PLATFORM_OBSERVABILITY_PORT,
      useExisting: InMemoryPrismaPlatformObservabilityAdapter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiMetricsInterceptor,
    },
  ],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
