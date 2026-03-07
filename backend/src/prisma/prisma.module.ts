import { Global, Module } from '@nestjs/common';
import { DistributedLockService } from './distributed-lock.service';
import { PrismaService } from './prisma.service';
import { DISTRIBUTED_LOCK_PORT } from '../shared/application/distributed-lock.port';
import { PrismaDistributedLockAdapter } from '../shared/infrastructure/transaction/prisma-distributed-lock.adapter';

@Global()
@Module({
  providers: [
    PrismaService,
    DistributedLockService,
    PrismaDistributedLockAdapter,
    { provide: DISTRIBUTED_LOCK_PORT, useExisting: PrismaDistributedLockAdapter },
  ],
  exports: [PrismaService, DistributedLockService, DISTRIBUTED_LOCK_PORT],
})
export class PrismaModule {}
