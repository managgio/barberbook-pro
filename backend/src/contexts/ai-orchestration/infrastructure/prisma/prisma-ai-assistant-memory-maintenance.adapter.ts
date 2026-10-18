import { Injectable } from '@nestjs/common';
import { AiAssistantMemoryMaintenancePort } from '../../ports/outbound/ai-assistant-memory-maintenance.port';
import { PrismaService } from '../../../../prisma/prisma.service';
import { runWithTenantScopeGuardBypassAsync } from '../../../../tenancy/tenant.context';

@Injectable()
export class PrismaAiAssistantMemoryMaintenanceAdapter implements AiAssistantMemoryMaintenancePort {
  constructor(private readonly prisma: PrismaService) {}

  async cleanupBeforeDate(start: Date): Promise<{
    aiMessagesDeleted: number;
    aiSessionsDeleted: number;
    aiSessionsResummarized: number;
  }> {
    return runWithTenantScopeGuardBypassAsync(async () => {
      const sessionsResult = await this.prisma.aiChatSession.deleteMany({
        where: {
          OR: [
            { lastMessageAt: { lt: start } },
            { lastMessageAt: null, createdAt: { lt: start } },
          ],
        },
      });
      const messagesResult = await this.prisma.aiChatMessage.deleteMany({
        where: { createdAt: { lt: start } },
      });

      return {
        aiMessagesDeleted: messagesResult.count,
        aiSessionsDeleted: sessionsResult.count,
        aiSessionsResummarized: 0,
      };
    });
  }

  async cleanupForLocalBeforeDate(localId: string, start: Date): Promise<{
    aiMessagesDeleted: number;
    aiSessionsDeleted: number;
    aiSessionsResummarized: number;
  }> {
    const [messagesResult, sessionsResult] = await Promise.all([
      this.prisma.aiChatMessage.deleteMany({
        where: {
          localId,
          createdAt: { lt: start },
        },
      }),
      this.prisma.aiChatSession.deleteMany({
        where: {
          localId,
          OR: [
            { lastMessageAt: { lt: start } },
            { lastMessageAt: null, createdAt: { lt: start } },
          ],
        },
      }),
    ]);

    return {
      aiMessagesDeleted: messagesResult.count,
      aiSessionsDeleted: sessionsResult.count,
      aiSessionsResummarized: 0,
    };
  }
}
