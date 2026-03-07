import { randomUUID } from 'crypto';

export type TenantJobLocationContext = {
  brandId: string;
  localId: string;
};

export type TenantJobMetrics = Record<string, number>;

export type TenantJobLogger = {
  log(message: string): void;
  warn?(message: string): void;
  error(message: string, trace?: string): void;
};

export type TenantJobActiveLocationIterator = {
  forEachActiveLocation(
    callback: (context: TenantJobLocationContext) => Promise<void>,
  ): Promise<void>;
};

export type TenantJobSummary = {
  jobName: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  locationsProcessed: number;
  locationsSucceeded: number;
  locationsFailed: number;
  failureRate: number;
  metrics: TenantJobMetrics;
};

export type TenantJobAlertPolicy = {
  failureRateWarnThreshold?: number;
  failedLocationsWarnThreshold?: number;
};

const mergeMetrics = (current: TenantJobMetrics, next: TenantJobMetrics | void): TenantJobMetrics => {
  if (!next) return current;
  const merged = { ...current };
  Object.entries(next).forEach(([key, value]) => {
    if (!Number.isFinite(value)) return;
    merged[key] = (merged[key] || 0) + value;
  });
  return merged;
};

export const runTenantScopedJob = async (params: {
  jobName: string;
  logger: TenantJobLogger;
  iterator: TenantJobActiveLocationIterator;
  executeForLocation: (context: TenantJobLocationContext) => Promise<TenantJobMetrics | void>;
  alertPolicy?: TenantJobAlertPolicy;
}): Promise<TenantJobSummary> => {
  const runId = randomUUID();
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const startedAtMs = startedAtDate.getTime();

  let locationsProcessed = 0;
  let locationsSucceeded = 0;
  let locationsFailed = 0;
  let metrics: TenantJobMetrics = {};

  params.logger.log(`[${params.jobName}] run started (runId=${runId})`);

  await params.iterator.forEachActiveLocation(async (context) => {
    locationsProcessed += 1;
    const localStartMs = Date.now();
    try {
      const localMetrics = await params.executeForLocation(context);
      metrics = mergeMetrics(metrics, localMetrics);
      locationsSucceeded += 1;
    } catch (error) {
      locationsFailed += 1;
      params.logger.error(
        `[${params.jobName}] local execution failed (runId=${runId}, brandId=${context.brandId}, localId=${context.localId}, durationMs=${Date.now() - localStartMs})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  });

  const finishedAtDate = new Date();
  const failureRate = locationsProcessed > 0 ? locationsFailed / locationsProcessed : 0;
  const summary: TenantJobSummary = {
    jobName: params.jobName,
    runId,
    startedAt,
    finishedAt: finishedAtDate.toISOString(),
    durationMs: finishedAtDate.getTime() - startedAtMs,
    locationsProcessed,
    locationsSucceeded,
    locationsFailed,
    failureRate,
    metrics,
  };

  params.logger.log(
    `[${params.jobName}] run completed (runId=${summary.runId}, durationMs=${summary.durationMs}, locationsProcessed=${summary.locationsProcessed}, locationsSucceeded=${summary.locationsSucceeded}, locationsFailed=${summary.locationsFailed}, failureRate=${summary.failureRate.toFixed(4)}, metrics=${JSON.stringify(summary.metrics)})`,
  );

  const failureRateWarnThreshold = params.alertPolicy?.failureRateWarnThreshold;
  const failedLocationsWarnThreshold = params.alertPolicy?.failedLocationsWarnThreshold;
  const shouldWarnByRate =
    typeof failureRateWarnThreshold === 'number' &&
    Number.isFinite(failureRateWarnThreshold) &&
    summary.failureRate > failureRateWarnThreshold;
  const shouldWarnByFailedLocations =
    typeof failedLocationsWarnThreshold === 'number' &&
    Number.isFinite(failedLocationsWarnThreshold) &&
    summary.locationsFailed >= failedLocationsWarnThreshold;

  if ((shouldWarnByRate || shouldWarnByFailedLocations) && params.logger.warn) {
    params.logger.warn(
      `[${params.jobName}] alert threshold reached (runId=${summary.runId}, failureRate=${summary.failureRate.toFixed(4)}, failureRateWarnThreshold=${failureRateWarnThreshold ?? 'n/a'}, locationsFailed=${summary.locationsFailed}, failedLocationsWarnThreshold=${failedLocationsWarnThreshold ?? 'n/a'})`,
    );
  }

  return summary;
};
