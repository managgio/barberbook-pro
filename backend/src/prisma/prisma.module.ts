import { Global, Module } from '@nestjs/common';
import { DistributedLockService } from './distributed-lock.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DistributedLockService],
  exports: [PrismaService, DistributedLockService],
})
export class PrismaModule {}
