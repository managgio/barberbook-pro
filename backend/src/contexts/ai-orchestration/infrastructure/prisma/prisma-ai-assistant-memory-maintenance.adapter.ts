import { Injectable } from '@nestjs/common';
import { AiAssistantMemoryMaintenancePort } from '../../ports/outbound/ai-assistant-memory-maintenance.port';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class PrismaAiAssistantMemoryMaintenanceAdapter implements AiAssistantMemoryMaintenancePort {
  constructor(private readonly prisma: PrismaService) {}

  async cleanupForLocalBeforeDate(localId: string, start: Date): Promise<{
    aiMessagesDeleted: number;
    aiSessionsDeleted: number;
    aiSessionsResummarized: number;
  }> {
    const [messagesResult, sessionsResult, summariesResult] = await Promise.all([
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
      this.prisma.aiChatSession.updateMany({
        where: { localId },
        data: { summary: '' },
      }),
    ]);

    return {
      aiMessagesDeleted: messagesResult.count,
      aiSessionsDeleted: sessionsResult.count,
      aiSessionsResummarized: summariesResult.count,
    };
  }
}
