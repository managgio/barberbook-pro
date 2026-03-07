export type TransactionIsolationLevel = 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';

export type UnitOfWorkOptions = {
  isolationLevel?: TransactionIsolationLevel;
};

export interface UnitOfWorkPort {
  runInTransaction<T>(work: () => Promise<T>, options?: UnitOfWorkOptions): Promise<T>;
}
