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
  generatedAt: string;
  range: { start: string; end: string };
  environment: string;
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
  tenantBreakdown: Array<{
    brandId: string;
    localId: string;
    name: PlatformWebVitalName;
    path: string;
    count: number;
    avg: number;
    p95: number;
    ratings: { good: number; needsImprovement: number; poor: number };
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
};

export type PlatformApiMetricSummary = {
  windowMinutes: number;
  generatedAt: string;
  range: { start: string; end: string };
  environment: string;
  totalEvents: number;
  topRoutes: Array<{
    brandId: string;
    localId: string;
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
    brandId: string;
    localId: string;
    subdomain: string | null;
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
    timestamp: number;
  }>;
};
