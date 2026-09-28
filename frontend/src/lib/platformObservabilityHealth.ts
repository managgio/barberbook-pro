import type { WebVitalMetricName } from '@/data/types';

export type HealthLevel = 'ok' | 'warning' | 'critical';

type WebVitalHealthInput = {
  name: WebVitalMetricName;
  p75: number;
};

const WEB_VITAL_THRESHOLDS: Record<WebVitalMetricName, { good: number; poor: number }> = {
  LCP: { good: 2_500, poor: 4_000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1_800, poor: 3_000 },
  TTFB: { good: 800, poor: 1_800 },
};

export const getWebVitalHealth = ({ name, p75 }: WebVitalHealthInput): HealthLevel => {
  const threshold = WEB_VITAL_THRESHOLDS[name];
  if (p75 > threshold.poor) return 'critical';
  if (p75 > threshold.good) return 'warning';
  return 'ok';
};
