import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { AI_TIME_ZONE, getDateStringInTimeZone, getDayBoundsInTimeZone } from './ai-assistant.utils';

const MAX_STORED_MESSAGES = 80;

@Injectable()
export class AiMemoryService {
  private lastCleanupDay: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureDailyCleanup(timeZone = AI_TIME_ZONE) {
    const now = new Date();
    const dayKey = getDateStringInTimeZone(now, timeZone);
    if (this.lastCleanupDay === dayKey) return;
    const { start } = getDayBoundsInTimeZone(dayKey, timeZone);
    const localId = getCurrentLocalId();
    await this.prisma.aiChatMessage.deleteMany({
      where: { createdAt: { lt: start }, localId },
    });
    await this.prisma.aiChatSession.deleteMany({
      where: {
        localId,
        OR: [
          { lastMessageAt: { lt: start } },
          { lastMessageAt: null, createdAt: { lt: start } },
        ],
      },
    });
    await this.prisma.aiChatSession.updateMany({
      where: { localId },
      data: { summary: '' },
    });
    this.lastCleanupDay = dayKey;
  }

  async getOrCreateSession(adminUserId: string, sessionId?: string | null) {
    await this.ensureDailyCleanup();
    if (sessionId) {
      const localId = getCurrentLocalId();
      const existing = await this.prisma.aiChatSession.findFirst({
        where: { id: sessionId, adminUserId, localId },
      });
      if (existing) {
        const dayKey = getDateStringInTimeZone(new Date(), AI_TIME_ZONE);
        const { start } = getDayBoundsInTimeZone(dayKey, AI_TIME_ZONE);
        if (existing.lastMessageAt && existing.lastMessageAt >= start) {
          return existing;
        }
      }
    }
    const localId = getCurrentLocalId();
    return this.prisma.aiChatSession.create({
      data: {
        localId,
        adminUserId,
        summary: '',
        lastMessageAt: new Date(),
      },
    });
  }

  async getDailyUserMessageCount(timeZone = AI_TIME_ZONE) {
    await this.ensureDailyCleanup(timeZone);
    const dayKey = getDateStringInTimeZone(new Date(), timeZone);
    const { start, end } = getDayBoundsInTimeZone(dayKey, timeZone);
    return this.prisma.aiChatMessage.count({
      where: {
        localId: getCurrentLocalId(),
        role: 'user',
        createdAt: { gte: start, lte: end },
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
    if (params.role === 'tool') {
      return null;
    }
    const message = await this.prisma.aiChatMessage.create({
      data: {
        localId: getCurrentLocalId(),
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        toolName: params.toolName ?? null,
        toolPayload: params.toolPayload ?? undefined,
      },
    });
    await this.prisma.aiChatSession.updateMany({
      where: { id: params.sessionId, localId: getCurrentLocalId() },
      data: { lastMessageAt: new Date() },
    });
    await this.trimSessionMessages(params.sessionId, MAX_STORED_MESSAGES);
    return message;
  }

  async getRecentMessages(sessionId: string, limit: number) {
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] }, localId: getCurrentLocalId() },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async getSessionMessages(sessionId: string, adminUserId: string, limit = 50) {
    await this.ensureDailyCleanup();
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, adminUserId, localId: getCurrentLocalId() },
    });
    if (!session) return null;
    if (session.lastMessageAt) {
      const dayKey = getDateStringInTimeZone(new Date(), AI_TIME_ZONE);
      const { start } = getDayBoundsInTimeZone(dayKey, AI_TIME_ZONE);
      if (session.lastMessageAt < start) {
        return null;
      }
    }
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] }, localId: getCurrentLocalId() },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return { session, messages };
  }

  async getSummary(sessionId: string) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, localId: getCurrentLocalId() },
    });
    return session?.summary || '';
  }

  async updateSummary(sessionId: string, summary: string) {
    await this.prisma.aiChatSession.updateMany({
      where: { id: sessionId, localId: getCurrentLocalId() },
      data: { summary },
    });
  }

  async shouldUpdateSummary(sessionId: string, every = 8) {
    const count = await this.prisma.aiChatMessage.count({
      where: { sessionId, role: { in: ['user', 'assistant'] }, localId: getCurrentLocalId() },
    });
    return count > 0 && count % every === 0;
  }

  async getFacts(limit = 10) {
    return this.prisma.aiBusinessFact.findMany({
      where: { localId: getCurrentLocalId() },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  private async trimSessionMessages(sessionId: string, keep = MAX_STORED_MESSAGES) {
    const localId = getCurrentLocalId();
    const keepIds = await this.prisma.aiChatMessage.findMany({
      where: { sessionId, localId },
      orderBy: { createdAt: 'desc' },
      take: keep,
      select: { id: true },
    });
    if (keepIds.length < keep) return;
    await this.prisma.aiChatMessage.deleteMany({
      where: {
        sessionId,
        localId,
        id: { notIn: keepIds.map((entry) => entry.id) },
      },
    });
  }
}
