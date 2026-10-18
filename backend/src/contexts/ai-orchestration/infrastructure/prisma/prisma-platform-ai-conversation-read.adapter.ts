import { Injectable } from '@nestjs/common';
import { AiChatInputSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { runWithTenantScopeGuardBypassAsync } from '../../../../tenancy/tenant.context';
import {
  PlatformAiConversationFilters,
  PlatformAiConversationReadPort,
} from '../../ports/outbound/platform-ai-conversation-read.port';

const RETENTION_DAYS = 90;

@Injectable()
export class PrismaPlatformAiConversationReadAdapter implements PlatformAiConversationReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: PlatformAiConversationFilters) {
    return runWithTenantScopeGuardBypassAsync(async () => {
      const now = new Date();
      const retentionCutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const requestedStart = new Date(now.getTime() - filters.days * 24 * 60 * 60 * 1000);
      const start = requestedStart > retentionCutoff ? requestedStart : retentionCutoff;
      const where = this.buildSessionWhere(filters, start);
      const skip = (filters.page - 1) * filters.pageSize;

      const [total, sessions, sourceGroups, messageCount, tenantGroups] = await Promise.all([
        this.prisma.aiChatSession.count({ where }),
        this.prisma.aiChatSession.findMany({
          where,
          orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: filters.pageSize,
          select: {
            id: true,
            localId: true,
            adminUserId: true,
            title: true,
            summary: true,
            createdAt: true,
            lastMessageAt: true,
            local: {
              select: {
                id: true,
                name: true,
                brand: { select: { id: true, name: true, subdomain: true } },
              },
            },
            messages: {
              where: { createdAt: { gte: start }, role: { in: ['user', 'assistant'] } },
              orderBy: { createdAt: 'desc' },
              take: 4,
              select: {
                id: true,
                role: true,
                content: true,
                inputSource: true,
                templateKey: true,
                createdAt: true,
              },
            },
            _count: { select: { messages: true } },
          },
        }),
        this.prisma.aiChatMessage.groupBy({
          by: ['inputSource'],
          where: this.buildMessageWhere(filters, start, true),
          _count: { _all: true },
        }),
        this.prisma.aiChatMessage.count({
          where: this.buildMessageWhere(filters, start, false),
        }),
        this.prisma.aiChatSession.groupBy({
          by: ['localId'],
          where,
          _count: { _all: true },
          orderBy: { _count: { localId: 'desc' } },
        }),
      ]);

      const adminUserIds = Array.from(new Set(sessions.map((session) => session.adminUserId)));
      const topTenantGroups = tenantGroups.slice(0, 12);
      const tenantLocalIds = topTenantGroups.map((group) => group.localId);
      const [admins, tenantLocations] = await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: adminUserIds } },
          select: { id: true, name: true, email: true },
        }),
        this.prisma.location.findMany({
          where: { id: { in: tenantLocalIds } },
          select: {
            id: true,
            name: true,
            brand: { select: { id: true, name: true, subdomain: true } },
          },
        }),
      ]);
      const adminById = new Map(admins.map((admin) => [admin.id, admin]));
      const locationById = new Map(tenantLocations.map((location) => [location.id, location]));
      const sourceCounts = { typed: 0, voice: 0, template: 0 };
      sourceGroups.forEach((group) => {
        if (group.inputSource) sourceCounts[group.inputSource] = group._count._all;
      });

      return {
        retentionDays: RETENTION_DAYS,
        range: { start: start.toISOString(), end: now.toISOString(), days: filters.days },
        summary: {
          sessions: total,
          messages: messageCount,
          activeTenants: tenantGroups.length,
          sources: sourceCounts,
        },
        tenantActivity: topTenantGroups.map((group) => {
          const location = locationById.get(group.localId);
          return {
            localId: group.localId,
            locationName: location?.name || 'Local',
            brandId: location?.brand.id || '',
            brandName: location?.brand.name || 'Tenant',
            subdomain: location?.brand.subdomain || '',
            sessions: group._count._all,
          };
        }),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasMore: filters.page * filters.pageSize < total,
        items: sessions.map((session) => ({
          id: session.id,
          brand: session.local.brand,
          location: { id: session.local.id, name: session.local.name },
          admin: adminById.get(session.adminUserId) || {
            id: session.adminUserId,
            name: 'Administrador',
            email: '',
          },
          title: session.title,
          summary: session.summary,
          createdAt: session.createdAt,
          lastMessageAt: session.lastMessageAt,
          messageCount: session._count.messages,
          preview: [...session.messages].reverse(),
        })),
      };
    });
  }

  async getById(sessionId: string) {
    return runWithTenantScopeGuardBypassAsync(async () => {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const session = await this.prisma.aiChatSession.findFirst({
        where: {
          id: sessionId,
          OR: [
            { lastMessageAt: { gte: cutoff } },
            { lastMessageAt: null, createdAt: { gte: cutoff } },
          ],
        },
        select: {
          id: true,
          adminUserId: true,
          title: true,
          summary: true,
          createdAt: true,
          lastMessageAt: true,
          local: {
            select: {
              id: true,
              name: true,
              brand: { select: { id: true, name: true, subdomain: true } },
            },
          },
          messages: {
            where: { createdAt: { gte: cutoff }, role: { in: ['user', 'assistant'] } },
            orderBy: { createdAt: 'asc' },
            take: 200,
            select: {
              id: true,
              role: true,
              content: true,
              inputSource: true,
              templateKey: true,
              createdAt: true,
            },
          },
        },
      });
      if (!session) return null;
      const admin = await this.prisma.user.findUnique({
        where: { id: session.adminUserId },
        select: { id: true, name: true, email: true },
      });
      return {
        id: session.id,
        brand: session.local.brand,
        location: { id: session.local.id, name: session.local.name },
        admin: admin || { id: session.adminUserId, name: 'Administrador', email: '' },
        title: session.title,
        summary: session.summary,
        createdAt: session.createdAt,
        lastMessageAt: session.lastMessageAt,
        messages: session.messages,
      };
    });
  }

  private buildSessionWhere(filters: PlatformAiConversationFilters, start: Date): Prisma.AiChatSessionWhereInput {
    const search = filters.search?.trim();
    return {
      OR: [
        { lastMessageAt: { gte: start } },
        { lastMessageAt: null, createdAt: { gte: start } },
      ],
      ...(filters.localId ? { localId: filters.localId } : {}),
      ...(filters.brandId ? { local: { brandId: filters.brandId } } : {}),
      ...(filters.source
        ? { messages: { some: { role: 'user', inputSource: filters.source, createdAt: { gte: start } } } }
        : {}),
      ...(search
        ? {
            AND: [{
              OR: [
                { title: { contains: search } },
                { summary: { contains: search } },
                { local: { name: { contains: search } } },
                { local: { brand: { name: { contains: search } } } },
                { messages: { some: { content: { contains: search }, createdAt: { gte: start } } } },
              ],
            }],
          }
        : {}),
    };
  }

  private buildMessageWhere(
    filters: PlatformAiConversationFilters,
    start: Date,
    userOnly: boolean,
  ): Prisma.AiChatMessageWhereInput {
    return {
      createdAt: { gte: start },
      ...(userOnly ? { role: 'user' as const } : { role: { in: ['user', 'assistant'] } }),
      ...(filters.source ? { inputSource: filters.source as AiChatInputSource } : {}),
      session: this.buildSessionWhere(filters, start),
    };
  }
}
