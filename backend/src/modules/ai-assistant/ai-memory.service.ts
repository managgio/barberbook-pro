import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_TIME_ZONE, getDateStringInTimeZone, getDayBoundsInTimeZone } from './ai-assistant.utils';

@Injectable()
export class AiMemoryService {
  private lastCleanupDay: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureDailyCleanup(timeZone = AI_TIME_ZONE) {
    const now = new Date();
    const dayKey = getDateStringInTimeZone(now, timeZone);
    if (this.lastCleanupDay === dayKey) return;
    const { start } = getDayBoundsInTimeZone(dayKey, timeZone);
    await this.prisma.aiChatMessage.deleteMany({
      where: { createdAt: { lt: start } },
    });
    await this.prisma.aiChatSession.updateMany({
      where: { lastMessageAt: { lt: start } },
      data: { summary: '' },
    });
    this.lastCleanupDay = dayKey;
  }

  async getOrCreateSession(adminUserId: string, sessionId?: string | null) {
    await this.ensureDailyCleanup();
    if (sessionId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: { id: sessionId, adminUserId },
      });
      if (existing) return existing;
    }
    return this.prisma.aiChatSession.create({
      data: {
        adminUserId,
        summary: '',
        lastMessageAt: new Date(),
      },
    });
  }

  async appendMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string | null;
    toolPayload?: unknown | null;
  }) {
    const message = await this.prisma.aiChatMessage.create({
      data: {
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        toolName: params.toolName ?? null,
        toolPayload: params.toolPayload ?? undefined,
      },
    });
    await this.prisma.aiChatSession.update({
      where: { id: params.sessionId },
      data: { lastMessageAt: new Date() },
    });
    return message;
  }

  async getRecentMessages(sessionId: string, limit: number) {
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async getSessionMessages(sessionId: string, adminUserId: string, limit = 50) {
    await this.ensureDailyCleanup();
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, adminUserId },
    });
    if (!session) return null;
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return { session, messages };
  }

  async getSummary(sessionId: string) {
    const session = await this.prisma.aiChatSession.findUnique({ where: { id: sessionId } });
    return session?.summary || '';
  }

  async updateSummary(sessionId: string, summary: string) {
    await this.prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { summary },
    });
  }

  async shouldUpdateSummary(sessionId: string, every = 8) {
    const count = await this.prisma.aiChatMessage.count({
      where: { sessionId, role: { in: ['user', 'assistant'] } },
    });
    return count > 0 && count % every === 0;
  }

  async getFacts(limit = 10) {
    return this.prisma.aiBusinessFact.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
