import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsScheduler implements OnModuleInit, OnModuleDestroy {
  private task: ScheduledTask | null = null;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit() {
    this.task = schedule('*/10 * * * *', () => {
      void this.handleExpiredPayments();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleExpiredPayments() {
    await this.distributedLock.runWithLock(
      'cron:payments-expired-cancel',
      async () => {
        await this.paymentsService.cancelExpiredStripePayments();
      },
      {
        ttlMs: 20 * 60_000,
        onLockedMessage: 'Skipping expired payment cleanup in this instance; lock already held',
      },
    );
  }
}
