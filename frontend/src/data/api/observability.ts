import { getStoredLocalId, getTenantSubdomainOverride } from '@/lib/tenant';
import { API_BASE, buildApiUrl } from './request';

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
