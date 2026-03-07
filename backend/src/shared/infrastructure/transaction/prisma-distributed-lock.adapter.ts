import { Injectable } from '@nestjs/common';
import { DistributedLockService } from '../../../prisma/distributed-lock.service';
import { DistributedLockPort, RunWithLockOptions } from '../../application/distributed-lock.port';

@Injectable()
export class PrismaDistributedLockAdapter implements DistributedLockPort {
  constructor(private readonly distributedLockService: DistributedLockService) {}

  runWithLock(key: string, fn: () => Promise<void>, options?: RunWithLockOptions): Promise<boolean> {
    return this.distributedLockService.runWithLock(key, fn, options);
  }
}
