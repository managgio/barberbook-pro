export type ApiErrorKind = 'HTTP' | 'TIMEOUT' | 'OFFLINE' | 'NETWORK' | 'ABORTED';

export class ApiRequestError extends Error {
  status: number;
  kind: ApiErrorKind;

  constructor(message: string, status: number, kind: ApiErrorKind) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.kind = kind;
  }
}

export const isApiRequestError = (error: unknown): error is ApiRequestError =>
  error instanceof ApiRequestError;
