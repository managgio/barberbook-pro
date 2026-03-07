export enum PlatformWebVitalName {
  LCP = 'LCP',
  CLS = 'CLS',
  INP = 'INP',
  FCP = 'FCP',
  TTFB = 'TTFB',
}

export enum PlatformWebVitalRating {
  GOOD = 'good',
  NEEDS_IMPROVEMENT = 'needs-improvement',
  POOR = 'poor',
}

export type PlatformWebVitalReport = {
  name: PlatformWebVitalName;
  value: number;
  rating: PlatformWebVitalRating;
  path: string;
  timestamp?: number;
};

export type PlatformWebVitalContext = {
  localId: string;
  brandId: string;
  userAgent?: string;
};

export type PlatformApiMetricRecord = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  localId: string;
  brandId: string;
  subdomain: string | null;
};

export type PlatformWebVitalSummary = {
  windowMinutes: number;
  totalEvents: number;
  byMetric: Array<{
    name: PlatformWebVitalName;
    count: number;
    avg: number;
    p75: number;
    p95: number;
    ratings: {
      good: number;
      needsImprovement: number;
      poor: number;
    };
  }>;
  topPoorPaths: Array<{ path: string; poorCount: number }>;
};

export type PlatformApiMetricSummary = {
  windowMinutes: number;
  totalEvents: number;
  topRoutes: Array<{
    method: string;
    route: string;
    subdomain: string | null;
    count: number;
    errorRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    statuses: Array<{ status: number; count: number }>;
  }>;
  slowestSamples: Array<{
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
    timestamp: number;
  }>;
};

