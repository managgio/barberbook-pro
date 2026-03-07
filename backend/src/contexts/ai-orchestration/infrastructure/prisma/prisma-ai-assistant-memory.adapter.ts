import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiAssistantMemoryPort } from '../../ports/outbound/ai-assistant-memory.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  AI_MEMORY_DEFAULT_TIME_ZONE,
  getDateStringInTimeZone,
  getDayBoundsInTimeZone,
} from '../support/ai-timezone-utils';

const MAX_STORED_MESSAGES = 80;

@Injectable()
export class PrismaAiAssistantMemoryAdapter implements AiAssistantMemoryPort {
  private readonly logger = new Logger(PrismaAiAssistantMemoryAdapter.name);
  private lastCleanupDay: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private async ensureDailyCleanup(timeZone = AI_MEMORY_DEFAULT_TIME_ZONE) {
    const now = new Date();
    const dayKey = getDateStringInTimeZone(now, timeZone);
    if (this.lastCleanupDay === dayKey) return;
    const { start } = getDayBoundsInTimeZone(dayKey, timeZone);
    const localId = this.getLocalId();
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

  async getOrCreateSession(adminUserId: string, sessionId?: string | null): Promise<{ id: string }> {
    await this.ensureDailyCleanup();
    const dayStart = this.getCurrentDayStart();
    const localId = this.getLocalId();
    if (sessionId) {
      const existing = await this.prisma.aiChatSession.findFirst({
        where: {
          id: sessionId,
          adminUserId,
          localId,
          OR: [
            { lastMessageAt: { gte: dayStart } },
            { lastMessageAt: null, createdAt: { gte: dayStart } },
          ],
        },
        select: { id: true, lastMessageAt: true },
      });
      if (existing) {
        return { id: existing.id };
      }
    }
    const latestSession = await this.prisma.aiChatSession.findFirst({
      where: {
        adminUserId,
        localId,
        OR: [
          { lastMessageAt: { gte: dayStart } },
          { lastMessageAt: null, createdAt: { gte: dayStart } },
        ],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (latestSession) {
      return { id: latestSession.id };
    }
    const created = await this.prisma.aiChatSession.create({
      data: {
        localId,
        adminUserId,
        summary: '',
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async getDailyUserMessageCount(adminUserId: string, timeZone: string): Promise<number> {
    await this.ensureDailyCleanup(timeZone);
    const dayKey = getDateStringInTimeZone(new Date(), timeZone);
    const { start, end } = getDayBoundsInTimeZone(dayKey, timeZone);
    return this.prisma.aiChatMessage.count({
      where: {
        localId: this.getLocalId(),
        role: 'user',
        session: { adminUserId },
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
  }): Promise<unknown> {
    if (params.role === 'tool') {
      return null;
    }
    const message = await this.prisma.aiChatMessage.create({
      data: {
        localId: this.getLocalId(),
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        toolName: params.toolName ?? null,
        toolPayload: params.toolPayload ?? undefined,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
    await this.prisma.aiChatSession.updateMany({
      where: { id: params.sessionId, localId: this.getLocalId() },
      data: { lastMessageAt: new Date() },
    });
    await this.trimSessionMessages(params.sessionId, MAX_STORED_MESSAGES);
    return message;
  }

  async getRecentMessages(sessionId: string, limit: number): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant'] }, localId: this.getLocalId() },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
      },
    });
    return messages.reverse();
  }

  async getSessionMessages(
    sessionId: string,
    adminUserId: string,
    limit = 50,
  ): Promise<{
    session: { id: string; summary: string };
    messages: Array<{ id: string; role: string; content: string; createdAt: Date }>;
  } | null> {
    try {
      await this.ensureDailyCleanup();
      const dayStart = this.getCurrentDayStart();
      const session = await this.prisma.aiChatSession.findFirst({
        where: {
          id: sessionId,
          adminUserId,
          localId: this.getLocalId(),
          OR: [
            { lastMessageAt: { gte: dayStart } },
            { lastMessageAt: null, createdAt: { gte: dayStart } },
          ],
        },
        select: { id: true, summary: true, lastMessageAt: true },
      });
      if (!session) return null;
      const messages = await this.prisma.aiChatMessage.findMany({
        where: { sessionId, role: { in: ['user', 'assistant'] }, localId: this.getLocalId() },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });
      return { session: { id: session.id, summary: session.summary || '' }, messages };
    } catch (error) {
      if (this.isRecoverableSessionReadError(error)) {
        this.logger.warn(
          `AI session read fallback to null (sessionId=${sessionId}, localId=${this.getLocalId()}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
      throw error;
    }
  }

  async getLatestSessionMessages(
    adminUserId: string,
    limit = 50,
  ): Promise<{
    session: { id: string; summary: string };
    messages: Array<{ id: string; role: string; content: string; createdAt: Date }>;
  } | null> {
    try {
      await this.ensureDailyCleanup();
      const dayStart = this.getCurrentDayStart();
      const session = await this.prisma.aiChatSession.findFirst({
        where: {
          adminUserId,
          localId: this.getLocalId(),
          OR: [
            { lastMessageAt: { gte: dayStart } },
            { lastMessageAt: null, createdAt: { gte: dayStart } },
          ],
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, summary: true },
      });
      if (!session) return null;
      const messages = await this.prisma.aiChatMessage.findMany({
        where: { sessionId: session.id, role: { in: ['user', 'assistant'] }, localId: this.getLocalId() },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });
      return { session: { id: session.id, summary: session.summary || '' }, messages };
    } catch (error) {
      if (this.isRecoverableSessionReadError(error)) {
        this.logger.warn(
          `AI latest session read fallback to null (adminUserId=${adminUserId}, localId=${this.getLocalId()}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
      throw error;
    }
  }

  async getSummary(sessionId: string): Promise<string> {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, localId: this.getLocalId() },
      select: { summary: true },
    });
    return session?.summary || '';
  }

  async updateSummary(sessionId: string, summary: string): Promise<void> {
    await this.prisma.aiChatSession.updateMany({
      where: { id: sessionId, localId: this.getLocalId() },
      data: { summary },
    });
  }

  async shouldUpdateSummary(sessionId: string, every = 8): Promise<boolean> {
    const count = await this.prisma.aiChatMessage.count({
      where: { sessionId, role: { in: ['user', 'assistant'] }, localId: this.getLocalId() },
    });
    return count > 0 && count % every === 0;
  }

  async getFacts(limit = 10): Promise<Array<{ key: string; value: string }>> {
    const facts = await this.prisma.aiBusinessFact.findMany({
      where: { localId: this.getLocalId() },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        key: true,
        value: true,
      },
    });
    return facts;
  }

  private async trimSessionMessages(sessionId: string, keep = MAX_STORED_MESSAGES) {
    const localId = this.getLocalId();
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

  private isRecoverableSessionReadError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return ['P2022', 'P2023', 'P2032'].includes(error.code);
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      const message = error.message.toLowerCase();
      return message.includes('aichatsession') || message.includes('aichatmessage');
    }
    return false;
  }

  private getCurrentDayStart(timeZone = AI_MEMORY_DEFAULT_TIME_ZONE) {
    const dayKey = getDateStringInTimeZone(new Date(), timeZone);
    return getDayBoundsInTimeZone(dayKey, timeZone).start;
  }
}
