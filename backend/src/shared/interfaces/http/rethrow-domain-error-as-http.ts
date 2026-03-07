import { HttpException } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';

type DomainErrorHttpMap = Record<string, () => HttpException>;

export const rethrowDomainErrorAsHttp = (error: unknown, map: DomainErrorHttpMap): void => {
  if (!(error instanceof DomainError)) return;
  const factory = map[error.code];
  if (!factory) return;
  throw factory();
};

