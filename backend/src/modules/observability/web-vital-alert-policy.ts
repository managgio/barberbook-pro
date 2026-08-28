import {
  PlatformWebVitalName,
  PlatformWebVitalReport,
} from '../../contexts/platform/domain/entities/platform-observability.entity';

export type WebVitalAlertThreshold = {
  good: number;
  poor: number;
  critical: number;
  unit: string;
};

export type WebVitalAlertThresholds = Record<PlatformWebVitalName, WebVitalAlertThreshold>;

const DEFAULT_WEB_VITAL_ALERT_THRESHOLDS: WebVitalAlertThresholds = {
  [PlatformWebVitalName.LCP]: { good: 2_500, poor: 4_000, critical: 10_000, unit: 'ms' },
  [PlatformWebVitalName.CLS]: { good: 0.1, poor: 0.25, critical: 1, unit: 'score' },
  [PlatformWebVitalName.INP]: { good: 200, poor: 500, critical: 2_000, unit: 'ms' },
  [PlatformWebVitalName.FCP]: { good: 1_800, poor: 3_000, critical: 8_000, unit: 'ms' },
  [PlatformWebVitalName.TTFB]: { good: 800, poor: 1_800, critical: 5_000, unit: 'ms' },
};

const WEB_VITAL_CRITICAL_ENV_KEYS: Record<PlatformWebVitalName, string> = {
  [PlatformWebVitalName.LCP]: 'OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_LCP',
  [PlatformWebVitalName.CLS]: 'OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_CLS',
  [PlatformWebVitalName.INP]: 'OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_INP',
  [PlatformWebVitalName.FCP]: 'OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_FCP',
  [PlatformWebVitalName.TTFB]: 'OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_TTFB',
};

const WEB_VITAL_ALERT_BLOCKED_PATH_PREFIXES = ['/platform'];
const IN_APP_BROWSER_UA_MARKERS = ['instagram', 'fban', 'fbav', 'tiktok', 'line/'];

const resolvePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const resolveWebVitalAlertThresholds = (
  env: NodeJS.ProcessEnv = process.env,
): WebVitalAlertThresholds => Object.fromEntries(
  Object.values(PlatformWebVitalName).map((name) => {
    const defaults = DEFAULT_WEB_VITAL_ALERT_THRESHOLDS[name];
    return [
      name,
      {
        ...defaults,
        critical: resolvePositiveNumber(env[WEB_VITAL_CRITICAL_ENV_KEYS[name]], defaults.critical),
      },
    ];
  }),
) as WebVitalAlertThresholds;

export const evaluateUrgentWebVitalAlert = (params: {
  payload: PlatformWebVitalReport;
  userAgent?: string;
  thresholds: WebVitalAlertThresholds;
}): { urgent: boolean; threshold: WebVitalAlertThreshold } => {
  const threshold = params.thresholds[params.payload.name];
  const path = params.payload.path || '';
  if (WEB_VITAL_ALERT_BLOCKED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return { urgent: false, threshold };
  }

  const normalizedUa = String(params.userAgent || '').toLowerCase();
  if (IN_APP_BROWSER_UA_MARKERS.some((marker) => normalizedUa.includes(marker))) {
    return { urgent: false, threshold };
  }

  return {
    urgent: Number(params.payload.value) >= threshold.critical,
    threshold,
  };
};
