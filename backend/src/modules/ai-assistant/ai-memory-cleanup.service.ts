import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { runForEachActiveLocation } from '../../tenancy/tenant.utils';
import { AI_TIME_ZONE, getDateStringInTimeZone, getDayBoundsInTimeZone } from './ai-assistant.utils';

@Injectable()
export class AiMemoryCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMemoryCleanupService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit() {
    this.task = schedule(
      '15 0 * * *',
      () => {
        void this.cleanupOldMessages();
      },
      { timezone: AI_TIME_ZONE },
    );
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async cleanupOldMessages() {
    const executed = await this.distributedLock.runWithLock(
      'cron:ai-memory-cleanup',
      async () => {
        await this.runCleanup();
      },
      {
        ttlMs: 30 * 60_000,
        onLockedMessage: 'Skipping AI memory cleanup in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runCleanup() {
    const now = new Date();
    const dayKey = getDateStringInTimeZone(now, AI_TIME_ZONE);
    const { start } = getDayBoundsInTimeZone(dayKey, AI_TIME_ZONE);
    let messagesDeleted = 0;
    let sessionsDeleted = 0;
    let sessionsSummarized = 0;

    await runForEachActiveLocation(this.prisma, async ({ brandId, localId }) => {
      try {
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

        messagesDeleted += messagesResult.count;
        sessionsDeleted += sessionsResult.count;
        sessionsSummarized += summariesResult.count;
      } catch (error) {
        this.logger.error(
          `AI cleanup failed for ${brandId}/${localId}.`,
          error instanceof Error ? error.stack : `${error}`,
        );
      }
    });

    if (messagesDeleted || sessionsDeleted || sessionsSummarized) {
      this.logger.log(
        `Limpieza IA: ${messagesDeleted} mensajes, ${sessionsDeleted} sesiones eliminadas y ${sessionsSummarized} sesiones re-sincronizadas.`,
      );
    }
  }
}
