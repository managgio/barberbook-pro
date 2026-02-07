import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

type RunWithLockOptions = {
  ttlMs?: number;
  waitMs?: number;
  retryEveryMs?: number;
  onLockedMessage?: string;
};

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly ownerId = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  private readonly lockPrefix = (process.env.DISTRIBUTED_LOCK_PREFIX || 'managgio').trim() || 'managgio';

  constructor(private readonly prisma: PrismaService) {}

  private normalizeLockKey(rawKey: string) {
    const sanitized = rawKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9:_-]/g, '-')
      .replace(/-+/g, '-');
    return `${this.lockPrefix}:${sanitized}`.slice(0, 120);
  }

  private async tryAcquire(lockKey: string, ttlMs: number) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const reused = await this.prisma.distributedLock.updateMany({
      where: {
        lockKey,
        OR: [
          { expiresAt: { lte: now } },
          { ownerId: this.ownerId },
        ],
      },
      data: {
        ownerId: this.ownerId,
        expiresAt,
      },
    });
    if (reused.count > 0) return true;

    try {
      await this.prisma.distributedLock.create({
        data: {
          lockKey,
          ownerId: this.ownerId,
          expiresAt,
        },
      });
      return true;
    } catch (error) {
      const isUniqueConstraint =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (isUniqueConstraint) return false;
      throw error;
    }
  }

  private async refresh(lockKey: string, ttlMs: number) {
    const nextExpiry = new Date(Date.now() + ttlMs);
    const refreshed = await this.prisma.distributedLock.updateMany({
      where: {
        lockKey,
        ownerId: this.ownerId,
      },
      data: {
        expiresAt: nextExpiry,
      },
    });
    return refreshed.count > 0;
  }

  private async release(lockKey: string) {
    await this.prisma.distributedLock.deleteMany({
      where: {
        lockKey,
        ownerId: this.ownerId,
      },
    });
  }

  async runWithLock(
    key: string,
    fn: () => Promise<void>,
    options?: RunWithLockOptions,
  ): Promise<boolean> {
    const ttlMs = Math.max(10_000, options?.ttlMs ?? 5 * 60_000);
    const waitMs = Math.max(0, options?.waitMs ?? 0);
    const retryEveryMs = Math.max(200, options?.retryEveryMs ?? 1_000);
    const lockKey = this.normalizeLockKey(key);
    const startedAt = Date.now();

    while (true) {
      const acquired = await this.tryAcquire(lockKey, ttlMs);
      if (acquired) break;
      if (Date.now() - startedAt >= waitMs) {
        if (options?.onLockedMessage) {
          this.logger.debug(`${options.onLockedMessage} key=${lockKey}`);
        }
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, retryEveryMs));
    }

    const heartbeat = setInterval(() => {
      void this.refresh(lockKey, ttlMs).catch((error) => {
        this.logger.warn(`Lock heartbeat failed key=${lockKey}: ${error instanceof Error ? error.message : error}`);
      });
    }, Math.max(2_000, Math.floor(ttlMs / 2)));
    heartbeat.unref();

    try {
      await fn();
      return true;
    } finally {
      clearInterval(heartbeat);
      await this.release(lockKey).catch((error) => {
        this.logger.warn(`Lock release failed key=${lockKey}: ${error instanceof Error ? error.message : error}`);
      });
    }
  }
}

