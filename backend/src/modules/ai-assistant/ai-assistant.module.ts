import { Module } from '@nestjs/common';
import {
  CHAT_WITH_AI_ASSISTANT_USE_CASE,
  CHAT_WITH_AI_ASSISTANT_USE_CASE_DEPS,
} from '../../contexts/ai-orchestration/application/use-cases/chat-with-ai-assistant.use-case';
import {
  GET_AI_ASSISTANT_SESSION_USE_CASE,
  GET_AI_ASSISTANT_SESSION_USE_CASE_DEPS,
} from '../../contexts/ai-orchestration/application/use-cases/get-ai-assistant-session.use-case';
import {
  TRANSCRIBE_AI_AUDIO_USE_CASE,
  TRANSCRIBE_AI_AUDIO_USE_CASE_DEPS,
} from '../../contexts/ai-orchestration/application/use-cases/transcribe-ai-audio.use-case';
import { OpenAiLlmAdapter } from '../../contexts/ai-orchestration/infrastructure/adapters/openai-ai-llm.adapter';
import { PrismaAiAssistantMemoryAdapter } from '../../contexts/ai-orchestration/infrastructure/prisma/prisma-ai-assistant-memory.adapter';
import { PrismaAiAssistantMemoryMaintenanceAdapter } from '../../contexts/ai-orchestration/infrastructure/prisma/prisma-ai-assistant-memory-maintenance.adapter';
import { PrismaAiAdminAccessReadAdapter } from '../../contexts/ai-orchestration/infrastructure/prisma/prisma-ai-admin-access-read.adapter';
import { PrismaAiToolsReadAdapter } from '../../contexts/ai-orchestration/infrastructure/prisma/prisma-ai-tools-read.adapter';
import { AI_ADMIN_ACCESS_READ_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-admin-access-read.port';
import { AI_ASSISTANT_MEMORY_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-assistant-memory.port';
import { AI_ASSISTANT_MEMORY_MAINTENANCE_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-assistant-memory-maintenance.port';
import { AI_ASSISTANT_TOOLS_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-assistant-tools.port';
import { AI_LLM_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-llm.port';
import { AI_TENANT_CONFIG_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-tenant-config.port';
import { AI_ALERT_TOOL_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-alert-tool.port';
import { AI_BOOKING_TOOL_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-booking-tool.port';
import { AI_HOLIDAY_TOOL_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-holiday-tool.port';
import { AI_TOOLS_READ_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-tools-read.port';
import { AI_USAGE_METRICS_PORT } from '../../contexts/ai-orchestration/ports/outbound/ai-usage-metrics.port';
import { TenantConfigAiTenantConfigAdapter } from '../../contexts/ai-orchestration/infrastructure/adapters/tenant-config-ai-tenant-config.adapter';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { AlertsModule } from '../alerts/alerts.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiToolsRegistry } from './ai-tools.registry';
import { AiAssistantGuard } from './ai-assistant.guard';
import { AiMemoryCleanupService } from './ai-memory-cleanup.service';
import { ModuleAiAlertToolAdapter } from './adapters/module-ai-alert-tool.adapter';
import { ModuleAiAssistantToolsAdapter } from './adapters/module-ai-assistant-tools.adapter';
import { ModuleAiUsageMetricsAdapter } from './adapters/module-ai-usage-metrics.adapter';
import { ModuleAiBookingToolAdapter } from './adapters/module-ai-booking-tool.adapter';
import { ModuleAiHolidayToolAdapter } from './adapters/module-ai-holiday-tool.adapter';
import {
  createChatWithAiAssistantUseCaseFromDeps,
  createGetAiAssistantSessionUseCaseFromDeps,
  createTranscribeAiAudioUseCaseFromDeps,
} from './ai-assistant.use-case-factories';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AppointmentsModule,
    SchedulesModule,
    HolidaysModule,
    AlertsModule,
    TenancyModule,
    UsageMetricsModule,
    AuthModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    PrismaAiAssistantMemoryAdapter,
    PrismaAiAssistantMemoryMaintenanceAdapter,
    { provide: AI_ADMIN_ACCESS_READ_PORT, useClass: PrismaAiAdminAccessReadAdapter },
    { provide: AI_TOOLS_READ_PORT, useClass: PrismaAiToolsReadAdapter },
    { provide: AI_BOOKING_TOOL_PORT, useClass: ModuleAiBookingToolAdapter },
    { provide: AI_HOLIDAY_TOOL_PORT, useClass: ModuleAiHolidayToolAdapter },
    { provide: AI_ALERT_TOOL_PORT, useClass: ModuleAiAlertToolAdapter },
    { provide: AI_ASSISTANT_MEMORY_PORT, useExisting: PrismaAiAssistantMemoryAdapter },
    { provide: AI_ASSISTANT_MEMORY_MAINTENANCE_PORT, useExisting: PrismaAiAssistantMemoryMaintenanceAdapter },
    { provide: AI_ASSISTANT_TOOLS_PORT, useClass: ModuleAiAssistantToolsAdapter },
    { provide: AI_USAGE_METRICS_PORT, useClass: ModuleAiUsageMetricsAdapter },
    { provide: AI_TENANT_CONFIG_PORT, useClass: TenantConfigAiTenantConfigAdapter },
    { provide: AI_LLM_PORT, useClass: OpenAiLlmAdapter },
    {
      provide: CHAT_WITH_AI_ASSISTANT_USE_CASE,
      useFactory: createChatWithAiAssistantUseCaseFromDeps,
      inject: Object.values(CHAT_WITH_AI_ASSISTANT_USE_CASE_DEPS),
    },
    {
      provide: GET_AI_ASSISTANT_SESSION_USE_CASE,
      useFactory: createGetAiAssistantSessionUseCaseFromDeps,
      inject: Object.values(GET_AI_ASSISTANT_SESSION_USE_CASE_DEPS),
    },
    {
      provide: TRANSCRIBE_AI_AUDIO_USE_CASE,
      useFactory: createTranscribeAiAudioUseCaseFromDeps,
      inject: Object.values(TRANSCRIBE_AI_AUDIO_USE_CASE_DEPS),
    },
    AiAssistantService,
    AiToolsRegistry,
    AiAssistantGuard,
    AiMemoryCleanupService,
  ],
})
export class AiAssistantModule {}
