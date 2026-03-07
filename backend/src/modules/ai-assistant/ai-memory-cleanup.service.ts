import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import {
  AI_ASSISTANT_MEMORY_MAINTENANCE_PORT,
  AiAssistantMemoryMaintenancePort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-assistant-memory-maintenance.port';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';
import { AI_TIME_ZONE, getDateStringInTimeZone, getDayBoundsInTimeZone } from './ai-assistant.utils';

@Injectable()
export class AiMemoryCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMemoryCleanupService.name);
  private task: ScheduledTask | null = null;

  constructor(
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
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
    const dayKey = getDateStringInTimeZone(now, AI_TIME_ZONE);
    const { start } = getDayBoundsInTimeZone(dayKey, AI_TIME_ZONE);
    await runTenantScopedJob({
      jobName: 'ai-memory-cleanup',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async ({ localId }) => {
        return this.aiAssistantMemoryMaintenancePort.cleanupForLocalBeforeDate(localId, start);
      },
    });
  }
}
