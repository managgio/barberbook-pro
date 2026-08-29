export type NotificationDeliveryRetryDecision =
  | { status: 'retrying'; nextAttemptAt: Date; promoteToCriticalTrace: false }
  | { status: 'failed'; nextAttemptAt: null; promoteToCriticalTrace: boolean };

const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

export const decideNotificationDeliveryRetry = (params: {
  now: Date;
  attemptCount: number;
  maxAttempts: number;
  retryable: boolean;
  critical: boolean;
}): NotificationDeliveryRetryDecision => {
  if (params.retryable && params.attemptCount < params.maxAttempts) {
    const delayIndex = Math.min(params.attemptCount - 1, RETRY_DELAYS_MS.length - 1);
    return {
      status: 'retrying',
      nextAttemptAt: new Date(params.now.getTime() + RETRY_DELAYS_MS[Math.max(0, delayIndex)]),
      promoteToCriticalTrace: false,
    };
  }

  return {
    status: 'failed',
    nextAttemptAt: null,
    promoteToCriticalTrace: params.critical || params.retryable,
  };
};
