import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_TIME_ZONE, getDateStringInTimeZone, getDayBoundsInTimeZone } from './ai-assistant.utils';

@Injectable()
export class AiMemoryCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMemoryCleanupService.name);
  private task: ScheduledTask | null = null;

  constructor(private readonly prisma: PrismaService) {}

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
    const now = new Date();
    const dayKey = getDateStringInTimeZone(now, AI_TIME_ZONE);
    const { start } = getDayBoundsInTimeZone(dayKey, AI_TIME_ZONE);
    const [messagesResult, sessionsResult] = await Promise.all([
      this.prisma.aiChatMessage.deleteMany({
        where: { createdAt: { lt: start } },
      }),
      this.prisma.aiChatSession.deleteMany({
        where: {
          OR: [
            { lastMessageAt: { lt: start } },
            { lastMessageAt: null, createdAt: { lt: start } },
          ],
        },
      }),
    ]);
    await this.prisma.aiChatSession.updateMany({
      data: { summary: '' },
    });

    if (messagesResult.count || sessionsResult.count) {
      this.logger.log(
        `Limpieza IA: ${messagesResult.count} mensajes y ${sessionsResult.count} sesiones antiguas eliminadas.`,
      );
    }
  }
}
