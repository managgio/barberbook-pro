import {
  PlatformApiMetricRecord,
  PlatformApiMetricSummary,
  PlatformWebVitalContext,
  PlatformWebVitalReport,
  PlatformWebVitalSummary,
} from '../../domain/entities/platform-observability.entity';

export const PLATFORM_OBSERVABILITY_PORT = Symbol('PLATFORM_OBSERVABILITY_PORT');

export interface PlatformObservabilityPort {
  recordWebVital(payload: PlatformWebVitalReport, context: PlatformWebVitalContext): void | Promise<void>;
  recordApiMetric(record: PlatformApiMetricRecord): void | Promise<void>;
  getWebVitalsSummary(windowMinutes?: number): Promise<PlatformWebVitalSummary>;
  getApiMetricsSummary(windowMinutes?: number): Promise<PlatformApiMetricSummary>;
}

