import { Injectable } from '@nestjs/common';
import { DistributedLockService } from '../../../../prisma/distributed-lock.service';
import { BookingIdempotencyPort } from '../../ports/outbound/booking-idempotency.port';

@Injectable()
export class DistributedLockBookingIdempotencyAdapter implements BookingIdempotencyPort {
  constructor(private readonly distributedLockService: DistributedLockService) {}

  async runOnce(key: string, work: () => Promise<void>): Promise<boolean> {
    return this.distributedLockService.runWithLock(
      key,
      async () => {
        await work();
      },
      {
        waitMs: 0,
        retryEveryMs: 250,
        ttlMs: 60_000,
        onLockedMessage: 'booking side effect skipped due to in-flight lock',
      },
    );
  }
}
