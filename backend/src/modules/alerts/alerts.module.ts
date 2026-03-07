import { Module } from '@nestjs/common';
import { PrismaAlertRepositoryAdapter } from '../../contexts/engagement/infrastructure/prisma/prisma-alert-repository.adapter';
import { ENGAGEMENT_ALERT_REPOSITORY_PORT } from '../../contexts/engagement/ports/outbound/alert-repository.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [TenancyModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    PrismaAlertRepositoryAdapter,
    {
      provide: ENGAGEMENT_ALERT_REPOSITORY_PORT,
      useExisting: PrismaAlertRepositoryAdapter,
    },
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
