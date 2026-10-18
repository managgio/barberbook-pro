import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import {
  AI_ASSISTANT_MEMORY_MAINTENANCE_PORT,
  AiAssistantMemoryMaintenancePort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-assistant-memory-maintenance.port';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import { AI_TIME_ZONE } from './ai-assistant.utils';

const AI_CONVERSATION_RETENTION_DAYS = 90;

@Injectable()
export class AiMemoryCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMemoryCleanupService.name);
  private task: ScheduledTask | null = null;

  constructor(
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    @Inject(AI_ASSISTANT_MEMORY_MAINTENANCE_PORT)
    private readonly aiAssistantMemoryMaintenancePort: AiAssistantMemoryMaintenancePort,
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
    const executed = await this.distributedLockPort.runWithLock(
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
    const retentionCutoff = new Date(
      now.getTime() - AI_CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const result = await this.aiAssistantMemoryMaintenancePort.cleanupBeforeDate(retentionCutoff);
    if (result.aiMessagesDeleted > 0 || result.aiSessionsDeleted > 0) {
      this.logger.log(
        `AI retention cleanup removed ${result.aiSessionsDeleted} sessions and ${result.aiMessagesDeleted} messages`,
      );
    }
  }
}
