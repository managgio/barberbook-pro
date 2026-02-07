import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportWebVitalDto, WebVitalName, WebVitalRating } from './dto/report-web-vital.dto';

type WebVitalRecord = {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  path: string;
  timestamp: number;
  localId: string;
  brandId: string;
  userAgent?: string;
};

type ApiMetricRecord = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  localId: string;
  brandId: string;
  subdomain: string | null;
};

const WEB_VITAL_RETENTION_MS = 24 * 60 * 60 * 1000;
const API_METRIC_RETENTION_MS = 6 * 60 * 60 * 1000;
const MAX_WEB_VITAL_RECORDS = 20_000;
const MAX_API_METRIC_RECORDS = 50_000;
const WEB_VITAL_NAMES = Object.values(WebVitalName);
const DEFAULT_ALERT_RECIPIENT = 'executive.managgio@gmail.com';
const DEFAULT_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const DEFAULT_API_ALERT_WINDOW_MINUTES = 5;
const DEFAULT_API_ALERT_MIN_SAMPLES = 20;
const DEFAULT_API_ALERT_ERROR_RATE_PERCENT = 25;
const DEFAULT_API_ALERT_ERROR_MIN_COUNT = 5;
const DEFAULT_API_ALERT_P95_MS = 1800;
const DEFAULT_PERSIST_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_PERSIST_BATCH_SIZE = 500;
const DEFAULT_PERSIST_BUFFER_LIMIT = 20_000;
const DEFAULT_PERSIST_RETENTION_DAYS = 30;
const DEFAULT_SUMMARY_QUERY_CAP = 120_000;

const WEB_VITAL_THRESHOLDS: Record<WebVitalName, { good: number; poor: number; unit: string }> = {
  [WebVitalName.LCP]: { good: 2500, poor: 4000, unit: 'ms' },
  [WebVitalName.CLS]: { good: 0.1, poor: 0.25, unit: 'score' },
  [WebVitalName.INP]: { good: 200, poor: 500, unit: 'ms' },
  [WebVitalName.FCP]: { good: 1800, poor: 3000, unit: 'ms' },
  [WebVitalName.TTFB]: { good: 800, poor: 1800, unit: 'ms' },
};

const clampWindowMinutes = (value?: number) => {
  if (!value || Number.isNaN(value)) return 60;
  return Math.min(7 * 24 * 60, Math.max(5, Math.floor(value)));
};

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseRecipients = (raw?: string) => {
  const fallback = [DEFAULT_ALERT_RECIPIENT];
  if (!raw?.trim()) return fallback;
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
};

const percentile = (values: number[], target: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * target) - 1));
  return Number(sorted[index].toFixed(2));
};

@Injectable()
export class ObservabilityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly webVitals: WebVitalRecord[] = [];
  private readonly apiMetrics: ApiMetricRecord[] = [];
  private readonly pendingWebVitals: WebVitalRecord[] = [];
  private readonly pendingApiMetrics: ApiMetricRecord[] = [];
  private readonly alertRecipients = parseRecipients(process.env.OBSERVABILITY_ALERT_EMAILS);
  private readonly alertCooldownMs = parseNumber(
    process.env.OBSERVABILITY_ALERT_COOLDOWN_MINUTES,
    DEFAULT_ALERT_COOLDOWN_MS / 60_000,
  ) * 60_000;
  private readonly apiAlertWindowMinutes = parseNumber(
    process.env.OBSERVABILITY_ALERT_API_WINDOW_MINUTES,
    DEFAULT_API_ALERT_WINDOW_MINUTES,
  );
  private readonly apiAlertMinSamples = parseNumber(
    process.env.OBSERVABILITY_ALERT_API_MIN_SAMPLES,
    DEFAULT_API_ALERT_MIN_SAMPLES,
  );
  private readonly apiAlertErrorRatePercent = parseNumber(
    process.env.OBSERVABILITY_ALERT_API_ERROR_RATE_PERCENT,
    DEFAULT_API_ALERT_ERROR_RATE_PERCENT,
  );
  private readonly apiAlertErrorMinCount = parseNumber(
    process.env.OBSERVABILITY_ALERT_API_ERROR_MIN_COUNT,
    DEFAULT_API_ALERT_ERROR_MIN_COUNT,
  );
  private readonly apiAlertP95Ms = parseNumber(
    process.env.OBSERVABILITY_ALERT_API_P95_MS,
    DEFAULT_API_ALERT_P95_MS,
  );
  private readonly persistFlushIntervalMs = parseNumber(
    process.env.OBSERVABILITY_PERSIST_FLUSH_MS,
    DEFAULT_PERSIST_FLUSH_INTERVAL_MS,
  );
  private readonly persistBatchSize = Math.max(
    100,
    parseNumber(process.env.OBSERVABILITY_PERSIST_BATCH_SIZE, DEFAULT_PERSIST_BATCH_SIZE),
  );
  private readonly persistBufferLimit = Math.max(
    5_000,
    parseNumber(process.env.OBSERVABILITY_PERSIST_BUFFER_LIMIT, DEFAULT_PERSIST_BUFFER_LIMIT),
  );
  private readonly persistedRetentionMs =
    parseNumber(process.env.OBSERVABILITY_PERSIST_RETENTION_DAYS, DEFAULT_PERSIST_RETENTION_DAYS) *
    24 *
    60 *
    60 *
    1000;
  private readonly summaryQueryCap = Math.max(
    5_000,
    parseNumber(process.env.OBSERVABILITY_SUMMARY_QUERY_CAP, DEFAULT_SUMMARY_QUERY_CAP),
  );
  private readonly alertCooldownByKey = new Map<string, number>();
  private alertTransporter: nodemailer.Transporter | null | undefined;
  private missingEmailConfigWarned = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushingWebVitals = false;
  private isFlushingApiMetrics = false;
  private lastPersistenceCleanupAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      void this.flushBuffers();
    }, this.persistFlushIntervalMs);
    this.flushTimer.unref();
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushBuffers(true);
  }

  private pruneAlertCooldown(now: number) {
    const retentionMs = this.alertCooldownMs * 3;
    this.alertCooldownByKey.forEach((lastTriggeredAt, key) => {
      if (now - lastTriggeredAt > retentionMs) {
        this.alertCooldownByKey.delete(key);
      }
    });
  }

  private shouldTriggerAlert(key: string, now: number) {
    this.pruneAlertCooldown(now);
    const lastTriggeredAt = this.alertCooldownByKey.get(key);
    if (lastTriggeredAt && now - lastTriggeredAt < this.alertCooldownMs) {
      return false;
    }
    this.alertCooldownByKey.set(key, now);
    return true;
  }

  private getAlertTransporter() {
    if (this.alertTransporter !== undefined) {
      return this.alertTransporter;
    }
    const user = process.env.EMAIL?.trim();
    const pass = process.env.PASSWORD?.trim();
    if (!user || !pass) {
      if (!this.missingEmailConfigWarned) {
        this.logger.warn('Observability alerts disabled: missing EMAIL/PASSWORD in environment');
        this.missingEmailConfigWarned = true;
      }
      this.alertTransporter = null;
      return this.alertTransporter;
    }
    const host = process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com';
    const port = parseNumber(process.env.EMAIL_PORT, 587);
    this.alertTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
    return this.alertTransporter;
  }

  private async sendAlertEmail(params: { subject: string; lines: string[] }) {
    const transporter = this.getAlertTransporter();
    if (!transporter) return;
    const senderEmail = process.env.EMAIL?.trim();
    if (!senderEmail) return;
    const fromName = process.env.EMAIL_FROM_NAME?.trim() || 'Managgio Observability';
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${senderEmail}>`,
        to: this.alertRecipients.join(', '),
        subject: params.subject,
        text: params.lines.join('\n'),
      });
    } catch (error) {
      this.logger.error(`Failed to send observability alert email: ${error}`);
    }
  }

  private formatTimestamp(value: number) {
    return new Date(value).toISOString();
  }

  private maybeAlertPoorWebVital(
    payload: ReportWebVitalDto,
    context: { localId: string; brandId: string; userAgent?: string },
  ) {
    if (payload.rating !== WebVitalRating.POOR) return;
    const now = Date.now();
    const key = `web-vital:${context.brandId}:${context.localId}:${payload.name}:${payload.path}`;
    if (!this.shouldTriggerAlert(key, now)) return;
    const threshold = WEB_VITAL_THRESHOLDS[payload.name];
    const lines = [
      'Se detecto una degradacion de Web Vitals.',
      '',
      `Metric: ${payload.name}`,
      `Value: ${Number(payload.value).toFixed(2)} ${threshold.unit}`,
      `Rating: ${payload.rating}`,
      `Thresholds: good <= ${threshold.good} ${threshold.unit}, poor > ${threshold.poor} ${threshold.unit}`,
      `Path: ${payload.path}`,
      `Brand ID: ${context.brandId}`,
      `Local ID: ${context.localId}`,
      `Timestamp: ${this.formatTimestamp(payload.timestamp || now)}`,
      `User-Agent: ${(context.userAgent || 'unknown').slice(0, 200)}`,
      '',
      `Cooldown active: ${Math.round(this.alertCooldownMs / 60_000)} minutes per metric/path/local`,
    ];
    void this.sendAlertEmail({
      subject: `[ALERTA][Web Vitals] ${payload.name} poor en ${payload.path}`,
      lines,
    });
  }

  private async maybeAlertApiDegradation(record: ApiMetricRecord) {
    if (record.statusCode < 500 && record.durationMs < this.apiAlertP95Ms) {
      return;
    }

    const now = Date.now();
    const windowMs = this.apiAlertWindowMinutes * 60_000;
    const since = now - windowMs;

    let routeSamples: Array<{ statusCode: number; durationMs: number }> = [];
    try {
      await this.flushApiMetrics();
      const persisted = await this.prisma.apiMetricEvent.findMany({
        where: {
          timestamp: { gte: new Date(since) },
          brandId: record.brandId,
          localId: record.localId,
          method: record.method,
          route: record.route,
        },
        select: {
          statusCode: true,
          durationMs: true,
        },
        orderBy: { timestamp: 'desc' },
        take: this.summaryQueryCap,
      });
      routeSamples = persisted.map((entry) => ({
        statusCode: entry.statusCode,
        durationMs: Number(entry.durationMs),
      }));
    } catch (error) {
      this.logger.warn(
        `Observability API alert fallback to memory: ${error instanceof Error ? error.message : error}`,
      );
    }

    if (routeSamples.length === 0) {
      routeSamples = this.apiMetrics
        .filter(
          (item) =>
            item.timestamp >= since &&
            item.brandId === record.brandId &&
            item.localId === record.localId &&
            item.method === record.method &&
            item.route === record.route,
        )
        .map((item) => ({ statusCode: item.statusCode, durationMs: item.durationMs }));
    }

    if (routeSamples.length < this.apiAlertMinSamples) {
      return;
    }

    const serverErrors = routeSamples.filter((item) => item.statusCode >= 500).length;
    const errorRate = (serverErrors / routeSamples.length) * 100;
    const durations = routeSamples.map((item) => item.durationMs);
    const p95DurationMs = percentile(durations, 0.95);
    const avgDurationMs = Number(
      (durations.reduce((acc, value) => acc + value, 0) / Math.max(1, durations.length)).toFixed(2),
    );

    const reasons: string[] = [];
    if (serverErrors >= this.apiAlertErrorMinCount && errorRate >= this.apiAlertErrorRatePercent) {
      reasons.push(
        `error rate 5xx ${errorRate.toFixed(2)}% (count ${serverErrors}/${routeSamples.length})`,
      );
    }
    if (p95DurationMs >= this.apiAlertP95Ms) {
      reasons.push(`p95 latency ${p95DurationMs}ms (threshold ${this.apiAlertP95Ms}ms)`);
    }
    if (!reasons.length) return;

    const key = `api-degraded:${record.brandId}:${record.localId}:${record.method}:${record.route}`;
    if (!this.shouldTriggerAlert(key, now)) return;

    const statusBuckets = new Map<number, number>();
    routeSamples.forEach((sample) => {
      statusBuckets.set(sample.statusCode, (statusBuckets.get(sample.statusCode) || 0) + 1);
    });
    const statuses = [...statusBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([status, count]) => `${status}:${count}`)
      .join(', ');

    const lines = [
      'Se detecto degradacion en una ruta de API.',
      '',
      `Route: ${record.method} ${record.route}`,
      `Brand ID: ${record.brandId}`,
      `Local ID: ${record.localId}`,
      `Window: last ${this.apiAlertWindowMinutes} minutes`,
      `Samples: ${routeSamples.length}`,
      `Reasons: ${reasons.join(' | ')}`,
      `Avg latency: ${avgDurationMs}ms`,
      `P95 latency: ${p95DurationMs}ms`,
      `5xx count: ${serverErrors}`,
      `Status distribution: ${statuses || 'n/a'}`,
      `Last event: status=${record.statusCode}, duration=${record.durationMs}ms at ${this.formatTimestamp(record.timestamp)}`,
      '',
      `Cooldown active: ${Math.round(this.alertCooldownMs / 60_000)} minutes per route/local`,
    ];

    void this.sendAlertEmail({
      subject: `[ALERTA][API] Degradacion ${record.method} ${record.route}`,
      lines,
    });
  }

  private pruneByRetention<T>(
    bucket: T[],
    params: { now: number; retentionMs: number; maxItems: number; resolveTimestamp: (item: T) => number },
  ) {
    const minTimestamp = params.now - params.retentionMs;
    while (bucket.length > 0 && params.resolveTimestamp(bucket[0]) < minTimestamp) {
      bucket.shift();
    }
    if (bucket.length > params.maxItems) {
      bucket.splice(0, bucket.length - params.maxItems);
    }
  }

  private pushPendingWebVital(record: WebVitalRecord) {
    this.pendingWebVitals.push(record);
    if (this.pendingWebVitals.length > this.persistBufferLimit) {
      this.pendingWebVitals.splice(0, this.pendingWebVitals.length - this.persistBufferLimit);
    }
    if (this.pendingWebVitals.length >= this.persistBatchSize) {
      void this.flushWebVitals();
    }
  }

  private pushPendingApiMetric(record: ApiMetricRecord) {
    this.pendingApiMetrics.push(record);
    if (this.pendingApiMetrics.length > this.persistBufferLimit) {
      this.pendingApiMetrics.splice(0, this.pendingApiMetrics.length - this.persistBufferLimit);
    }
    if (this.pendingApiMetrics.length >= this.persistBatchSize) {
      void this.flushApiMetrics();
    }
  }

  private async flushBuffers(force = false) {
    await Promise.all([
      this.flushWebVitals(force),
      this.flushApiMetrics(force),
    ]);
    await this.maybeCleanupPersistedMetrics();
  }

  private async flushWebVitals(force = false) {
    if (this.isFlushingWebVitals) return;
    if (this.pendingWebVitals.length === 0) return;
    this.isFlushingWebVitals = true;

    const maxBatches = force ? Number.POSITIVE_INFINITY : 2;
    let processed = 0;
    try {
      while (this.pendingWebVitals.length > 0 && processed < maxBatches) {
        processed += 1;
        const batch = this.pendingWebVitals.splice(0, this.persistBatchSize);
        if (batch.length === 0) break;
        await this.prisma.webVitalEvent.createMany({
          data: batch.map((item) => ({
            brandId: item.brandId,
            localId: item.localId,
            name: item.name,
            value: item.value,
            rating: item.rating,
            path: item.path,
            timestamp: new Date(item.timestamp),
            userAgent: item.userAgent || null,
          })),
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to flush web vitals to DB: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.isFlushingWebVitals = false;
      if (!force && this.pendingWebVitals.length > 0) {
        void this.flushWebVitals();
      }
    }
  }

  private async flushApiMetrics(force = false) {
    if (this.isFlushingApiMetrics) return;
    if (this.pendingApiMetrics.length === 0) return;
    this.isFlushingApiMetrics = true;

    const maxBatches = force ? Number.POSITIVE_INFINITY : 2;
    let processed = 0;
    try {
      while (this.pendingApiMetrics.length > 0 && processed < maxBatches) {
        processed += 1;
        const batch = this.pendingApiMetrics.splice(0, this.persistBatchSize);
        if (batch.length === 0) break;
        await this.prisma.apiMetricEvent.createMany({
          data: batch.map((item) => ({
            brandId: item.brandId,
            localId: item.localId,
            subdomain: item.subdomain,
            method: item.method,
            route: item.route,
            statusCode: item.statusCode,
            durationMs: item.durationMs,
            timestamp: new Date(item.timestamp),
          })),
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to flush API metrics to DB: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.isFlushingApiMetrics = false;
      if (!force && this.pendingApiMetrics.length > 0) {
        void this.flushApiMetrics();
      }
    }
  }

  private async maybeCleanupPersistedMetrics() {
    const now = Date.now();
    if (now - this.lastPersistenceCleanupAt < 15 * 60_000) return;
    this.lastPersistenceCleanupAt = now;

    await this.distributedLock.runWithLock(
      'cron:observability-retention',
      async () => {
        const cutoff = new Date(now - this.persistedRetentionMs);
        await Promise.all([
          this.prisma.webVitalEvent.deleteMany({
            where: { timestamp: { lt: cutoff } },
          }),
          this.prisma.apiMetricEvent.deleteMany({
            where: { timestamp: { lt: cutoff } },
          }),
        ]);
      },
      {
        ttlMs: 5 * 60_000,
        onLockedMessage: 'Skipping observability retention in this instance; lock already held',
      },
    );
  }

  recordWebVital(
    payload: ReportWebVitalDto,
    context: { localId: string; brandId: string; userAgent?: string },
  ) {
    const now = Date.now();
    const safeTimestamp =
      typeof payload.timestamp === 'number' && Number.isFinite(payload.timestamp) && payload.timestamp > 0
        ? payload.timestamp
        : now;

    const record: WebVitalRecord = {
      name: payload.name,
      value: Number(payload.value),
      rating: payload.rating,
      path: payload.path.slice(0, 300),
      timestamp: safeTimestamp,
      localId: context.localId,
      brandId: context.brandId,
      userAgent: context.userAgent?.slice(0, 200),
    };

    this.webVitals.push(record);
    this.pushPendingWebVital(record);

    this.pruneByRetention(this.webVitals, {
      now,
      retentionMs: WEB_VITAL_RETENTION_MS,
      maxItems: MAX_WEB_VITAL_RECORDS,
      resolveTimestamp: (item) => item.timestamp,
    });

    if (payload.rating === WebVitalRating.POOR) {
      this.logger.warn(
        `WebVital poor: ${payload.name}=${payload.value.toFixed(2)} path=${payload.path} local=${context.localId}`,
      );
    }
    this.maybeAlertPoorWebVital(payload, context);
  }

  recordApiMetric(record: ApiMetricRecord) {
    const now = Date.now();
    const normalized: ApiMetricRecord = {
      ...record,
      durationMs: Number(record.durationMs.toFixed(2)),
      route: record.route.slice(0, 220),
      method: record.method.slice(0, 12).toUpperCase(),
    };

    this.apiMetrics.push(normalized);
    this.pushPendingApiMetric(normalized);

    this.pruneByRetention(this.apiMetrics, {
      now,
      retentionMs: API_METRIC_RETENTION_MS,
      maxItems: MAX_API_METRIC_RECORDS,
      resolveTimestamp: (item) => item.timestamp,
    });

    void this.maybeAlertApiDegradation(normalized);
  }

  private async loadWebVitalsSince(sinceMs: number) {
    try {
      await this.flushWebVitals();
      const records = await this.prisma.webVitalEvent.findMany({
        where: {
          timestamp: { gte: new Date(sinceMs) },
        },
        select: {
          name: true,
          value: true,
          rating: true,
          path: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
        take: this.summaryQueryCap,
      });
      return records.map((record) => ({
        name: record.name as WebVitalName,
        value: Number(record.value),
        rating: record.rating as WebVitalRating,
        path: record.path,
        timestamp: record.timestamp.getTime(),
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to load web vitals from DB, using memory fallback: ${error instanceof Error ? error.message : error}`,
      );
      return this.webVitals
        .filter((item) => item.timestamp >= sinceMs)
        .map((item) => ({
          name: item.name,
          value: item.value,
          rating: item.rating,
          path: item.path,
          timestamp: item.timestamp,
        }));
    }
  }

  private async loadApiMetricsSince(sinceMs: number) {
    try {
      await this.flushApiMetrics();
      const records = await this.prisma.apiMetricEvent.findMany({
        where: {
          timestamp: { gte: new Date(sinceMs) },
        },
        select: {
          method: true,
          route: true,
          subdomain: true,
          statusCode: true,
          durationMs: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
        take: this.summaryQueryCap,
      });
      return records.map((record) => ({
        method: record.method,
        route: record.route,
        subdomain: record.subdomain,
        statusCode: record.statusCode,
        durationMs: Number(record.durationMs),
        timestamp: record.timestamp.getTime(),
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to load API metrics from DB, using memory fallback: ${error instanceof Error ? error.message : error}`,
      );
      return this.apiMetrics
        .filter((item) => item.timestamp >= sinceMs)
        .map((item) => ({
          method: item.method,
          route: item.route,
          subdomain: item.subdomain,
          statusCode: item.statusCode,
          durationMs: item.durationMs,
          timestamp: item.timestamp,
        }));
    }
  }

  async getWebVitalsSummary(windowMinutes?: number) {
    const safeWindowMinutes = clampWindowMinutes(windowMinutes);
    const since = Date.now() - safeWindowMinutes * 60_000;
    const recent = await this.loadWebVitalsSince(since);

    const byMetric = WEB_VITAL_NAMES.map((name) => {
      const metricRecords = recent.filter((item) => item.name === name);
      const values = metricRecords.map((item) => item.value);
      const ratings = {
        good: metricRecords.filter((item) => item.rating === WebVitalRating.GOOD).length,
        needsImprovement: metricRecords.filter(
          (item) => item.rating === WebVitalRating.NEEDS_IMPROVEMENT,
        ).length,
        poor: metricRecords.filter((item) => item.rating === WebVitalRating.POOR).length,
      };
      return {
        name,
        count: metricRecords.length,
        avg:
          values.length === 0
            ? 0
            : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
        p75: percentile(values, 0.75),
        p95: percentile(values, 0.95),
        ratings,
      };
    }).filter((entry) => entry.count > 0);

    const poorByPath = new Map<string, number>();
    recent.forEach((entry) => {
      if (entry.rating !== WebVitalRating.POOR) return;
      poorByPath.set(entry.path, (poorByPath.get(entry.path) || 0) + 1);
    });

    return {
      windowMinutes: safeWindowMinutes,
      totalEvents: recent.length,
      byMetric,
      topPoorPaths: [...poorByPath.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([path, poorCount]) => ({ path, poorCount })),
    };
  }

  async getApiMetricsSummary(windowMinutes?: number) {
    const safeWindowMinutes = clampWindowMinutes(windowMinutes);
    const since = Date.now() - safeWindowMinutes * 60_000;
    const recent = await this.loadApiMetricsSince(since);

    const grouped = new Map<
      string,
      {
        method: string;
        route: string;
        subdomain: string | null;
        count: number;
        errorCount: number;
        totalDurationMs: number;
        durations: number[];
        statusBuckets: Map<number, number>;
      }
    >();

    recent.forEach((entry) => {
      const key = `${entry.method} ${entry.route}::${entry.subdomain || 'unknown'}`;
      const bucket = grouped.get(key) || {
        method: entry.method,
        route: entry.route,
        subdomain: entry.subdomain,
        count: 0,
        errorCount: 0,
        totalDurationMs: 0,
        durations: [],
        statusBuckets: new Map<number, number>(),
      };
      bucket.count += 1;
      if (entry.statusCode >= 400) {
        bucket.errorCount += 1;
      }
      bucket.totalDurationMs += entry.durationMs;
      bucket.durations.push(entry.durationMs);
      bucket.statusBuckets.set(entry.statusCode, (bucket.statusBuckets.get(entry.statusCode) || 0) + 1);
      grouped.set(key, bucket);
    });

    const topRoutes = [...grouped.values()]
      .map((bucket) => ({
        method: bucket.method,
        route: bucket.route,
        subdomain: bucket.subdomain,
        count: bucket.count,
        errorRate: Number(((bucket.errorCount / Math.max(1, bucket.count)) * 100).toFixed(2)),
        avgDurationMs: Number((bucket.totalDurationMs / Math.max(1, bucket.count)).toFixed(2)),
        p95DurationMs: percentile(bucket.durations, 0.95),
        statuses: [...bucket.statusBuckets.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([status, count]) => ({ status, count })),
      }))
      .sort((a, b) => b.p95DurationMs - a.p95DurationMs)
      .slice(0, 30);

    const slowestSamples = [...recent]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 20)
      .map((entry) => ({
        method: entry.method,
        route: entry.route,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        timestamp: entry.timestamp,
      }));

    return {
      windowMinutes: safeWindowMinutes,
      totalEvents: recent.length,
      topRoutes,
      slowestSamples,
    };
  }
}
