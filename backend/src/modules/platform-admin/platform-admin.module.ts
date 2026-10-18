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
import { PlatformI18nObservabilityService } from './platform-i18n-observability.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformAiConversationsController } from './platform-ai-conversations.controller';
import { PlatformAiConversationsService } from './platform-ai-conversations.service';
import { PrismaPlatformAiConversationReadAdapter } from '../../contexts/ai-orchestration/infrastructure/prisma/prisma-platform-ai-conversation-read.adapter';
import { PLATFORM_AI_CONVERSATION_READ_PORT } from '../../contexts/ai-orchestration/ports/outbound/platform-ai-conversation-read.port';
import { EngagementNotificationGatewayModule } from '../../contexts/engagement/infrastructure/modules/engagement-notification-gateway.module';

@Module({
  imports: [
    PrismaModule,
    UsageMetricsModule,
    ImageKitModule,
    AuthModule,
    ObservabilityModule,
    NotificationsModule,
    EngagementNotificationGatewayModule,
  ],
  controllers: [PlatformAdminController, PlatformAiConversationsController],
  providers: [
    PlatformAdminService,
    PlatformI18nObservabilityService,
    PlatformAiConversationsService,
    PlatformAdminGuard,
    PrismaPlatformAiConversationReadAdapter,
    {
      provide: PLATFORM_AI_CONVERSATION_READ_PORT,
      useExisting: PrismaPlatformAiConversationReadAdapter,
    },
    PrismaImageKitPlatformAdminManagementAdapter,
    {
      provide: PLATFORM_ADMIN_MANAGEMENT_PORT,
      useExisting: PrismaImageKitPlatformAdminManagementAdapter,
    },
  ],
})
export class PlatformAdminModule {}
