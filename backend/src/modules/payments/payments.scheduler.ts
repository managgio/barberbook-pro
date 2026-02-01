import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsScheduler implements OnModuleDestroy {
  private task: ScheduledTask | null = null;

  constructor(private readonly paymentsService: PaymentsService) {
    this.task = schedule('*/10 * * * *', () => {
      void this.paymentsService.cancelExpiredStripePayments();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }
}
