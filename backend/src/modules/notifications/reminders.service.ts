import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { RunNotificationRemindersUseCase } from '../../contexts/engagement/application/use-cases/run-notification-reminders.use-case';
import {
  ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT,
  EngagementNotificationManagementPort,
} from '../../contexts/engagement/ports/outbound/notification-management.port';
import {
  ENGAGEMENT_NOTIFICATION_REMINDER_PORT,
  EngagementNotificationReminderPort,
} from '../../contexts/engagement/ports/outbound/notification-reminder.port';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import { TENANT_CONFIG_READ_PORT, TenantConfigReadPort } from '../../shared/application/tenant-config-read.port';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';

const REMINDER_OFFSET_MS = 24 * 60 * 60 * 1000; // 24h
const REMINDER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window to avoid repeats if job runs often

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private task: ScheduledTask | null = null;
  private readonly runNotificationRemindersUseCase: RunNotificationRemindersUseCase;

  constructor(
    @Inject(TENANT_CONFIG_READ_PORT)
    private readonly tenantConfigReadPort: TenantConfigReadPort,
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
    @Inject(ENGAGEMENT_NOTIFICATION_REMINDER_PORT)
    private readonly reminderPort: EngagementNotificationReminderPort,
    @Inject(ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT)
    private readonly notificationManagementPort: EngagementNotificationManagementPort,
  ) {
    this.runNotificationRemindersUseCase = new RunNotificationRemindersUseCase(
      this.reminderPort,
      this.notificationManagementPort,
    );
  }

  onModuleInit() {
    // Every 5 minutes
    this.task = schedule('*/5 * * * *', () => this.handleReminders());
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleReminders() {
    const executed = await this.distributedLockPort.runWithLock(
      'cron:notifications-reminders',
      async () => {
        await this.runReminders();
      },
      {
        ttlMs: 10 * 60_000,
        onLockedMessage: 'Skipping reminders in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runReminders() {
    await runTenantScopedJob({
      jobName: 'notifications-reminders',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async () => {
        const sent = await this.handleRemindersForLocal();
        return { remindersSent: sent };
      },
    });
  }

  private async handleRemindersForLocal() {
    const config = await this.tenantConfigReadPort.getEffectiveConfig();
    const smsEnabled = config.notificationPrefs?.sms !== false;
    const whatsappEnabled = config.notificationPrefs?.whatsapp !== false;
    if (!smsEnabled && !whatsappEnabled) {
      return 0;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() + REMINDER_OFFSET_MS - REMINDER_WINDOW_MS);
    const windowEnd = new Date(now.getTime() + REMINDER_OFFSET_MS + REMINDER_WINDOW_MS);

    return this.runNotificationRemindersUseCase.execute({
      windowStart,
      windowEnd,
      smsEnabled,
      whatsappEnabled,
    });
  }
}
