import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { AlertsModule } from '../alerts/alerts.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiMemoryService } from './ai-memory.service';
import { AiToolsRegistry } from './ai-tools.registry';
import { AiAssistantGuard } from './ai-assistant.guard';
import { AiMemoryCleanupService } from './ai-memory-cleanup.service';

@Module({
  imports: [
    PrismaModule,
    AppointmentsModule,
    SchedulesModule,
    HolidaysModule,
    AlertsModule,
    TenancyModule,
    UsageMetricsModule,
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService, AiMemoryService, AiToolsRegistry, AiAssistantGuard, AiMemoryCleanupService],
})
export class AiAssistantModule {}
