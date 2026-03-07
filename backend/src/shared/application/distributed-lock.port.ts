export const DISTRIBUTED_LOCK_PORT = Symbol('DISTRIBUTED_LOCK_PORT');

export type RunWithLockOptions = {
  ttlMs?: number;
  waitMs?: number;
  retryEveryMs?: number;
  onLockedMessage?: string;
};

export interface DistributedLockPort {
  runWithLock(key: string, fn: () => Promise<void>, options?: RunWithLockOptions): Promise<boolean>;
}
