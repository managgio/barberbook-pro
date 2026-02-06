import {
  PlatformObservabilityApiSummary,
  PlatformObservabilityWebVitalsSummary,
} from '@/data/types';
import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';
import { API_BASE, buildApiUrl } from './request';
import { apiRequest } from './request';

type WebVitalPayload = {
  name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  path: string;
  timestamp: number;
};

export const reportWebVital = (payload: WebVitalPayload) => {
  const localId = getStoredLocalId();
  const tenantSubdomain = getTenantSubdomainOverride();
  const url = buildApiUrl(`${API_BASE}/observability/web-vitals`);

  void fetch(url, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(localId ? { 'x-local-id': localId } : {}),
      ...(tenantSubdomain ? { 'x-tenant-subdomain': tenantSubdomain } : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
};

export const getPlatformWebVitalsSummary = async (
  minutes: number,
): Promise<PlatformObservabilityWebVitalsSummary> =>
  apiRequest('/platform/observability/web-vitals', {
    query: { minutes },
  });

export const getPlatformApiMetricsSummary = async (
  minutes: number,
): Promise<PlatformObservabilityApiSummary> =>
  apiRequest('/platform/observability/api', {
    query: { minutes },
  });
