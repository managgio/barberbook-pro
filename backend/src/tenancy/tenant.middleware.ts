import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { runWithTenantContext } from './tenant.context';
import { TenantResolutionError, TenantService } from './tenant.service';
import {
  DEFAULT_BRAND_ID,
  DEFAULT_LOCAL_ID,
  TENANT_ALLOW_HEADER_OVERRIDES,
  TENANT_BASE_DOMAIN,
  TENANT_TRUST_X_FORWARDED_HOST,
} from './tenant.constants';

const firstHeaderValue = (value?: string | string[]) => {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(',')[0]?.trim() || undefined;
};

const normalizeHost = (value?: string) => value?.split(':')[0]?.trim().toLowerCase() || '';

const normalizeBaseDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');

const CONFIGURED_BASE_DOMAIN = normalizeBaseDomain(TENANT_BASE_DOMAIN);

const belongsToConfiguredBaseDomain = (hostname: string) =>
  !!CONFIGURED_BASE_DOMAIN &&
  (hostname === CONFIGURED_BASE_DOMAIN || hostname.endsWith(`.${CONFIGURED_BASE_DOMAIN}`));

const isLikelyInternalHost = (hostname: string) => {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (!hostname.includes('.')) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  return hostname.startsWith('backend') || hostname.startsWith('api');
};

const getSubdomainFromHostname = (hostname: string) => {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 3) return null;
  return parts[0]?.toLowerCase() || null;
};

const getHostnameFromUrlHeader = (value?: string) => {
  if (!value) return '';
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return '';
  }
};

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, _res: Response, next: () => void) {
    if (req.originalUrl?.startsWith('/api/payments/stripe/webhook')) {
      runWithTenantContext(
        {
          brandId: DEFAULT_BRAND_ID,
          localId: DEFAULT_LOCAL_ID,
          host: typeof req.headers.host === 'string' ? req.headers.host : undefined,
          subdomain: null,
          isPlatform: false,
        },
        () => {
          (req as any).tenant = {
            brandId: DEFAULT_BRAND_ID,
            localId: DEFAULT_LOCAL_ID,
            subdomain: null,
            isPlatform: false,
          };
          next();
        },
      );
      return;
    }
    const directHost = firstHeaderValue(req.headers.host);
    const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
    const directHostname = normalizeHost(directHost);
    const forwardedHostname = normalizeHost(forwardedHost);

    // In production behind reverse proxies, host can be internal (api/backend service name).
    // Fall back to x-forwarded-host when direct host is internal or doesn't belong to tenant base domain.
    const host =
      (TENANT_TRUST_X_FORWARDED_HOST
        ? forwardedHost || directHost
        : forwardedHost &&
            (isLikelyInternalHost(directHostname) ||
              (!belongsToConfiguredBaseDomain(directHostname) &&
                belongsToConfiguredBaseDomain(forwardedHostname)))
          ? forwardedHost
          : directHost) || undefined;
    const headerSubdomain =
      typeof req.headers['x-tenant-subdomain'] === 'string'
        ? req.headers['x-tenant-subdomain'].trim().toLowerCase()
        : null;
    const originHostname = getHostnameFromUrlHeader(firstHeaderValue(req.headers.origin));
    const refererHostname = getHostnameFromUrlHeader(firstHeaderValue(req.headers.referer));
    const originSubdomain = getSubdomainFromHostname(originHostname);
    const refererSubdomain = getSubdomainFromHostname(refererHostname);
    const publicRequestSubdomain = originSubdomain || refererSubdomain;

    // Safe fallback:
    // when overrides are disabled, trust x-tenant-subdomain only if it matches browser Origin/Referer hostname.
    const subdomainOverride = TENANT_ALLOW_HEADER_OVERRIDES
      ? headerSubdomain
      : headerSubdomain && publicRequestSubdomain === headerSubdomain
        ? headerSubdomain
        : null;
    const localIdOverride =
      TENANT_ALLOW_HEADER_OVERRIDES &&
      typeof req.headers['x-local-id'] === 'string'
        ? req.headers['x-local-id']
        : null;

    let resolution;
    try {
      resolution = await this.tenantService.resolveTenant({
        host,
        subdomainOverride,
        localIdOverride,
      });
    } catch (error) {
      if (error instanceof TenantResolutionError) {
        _res.status(error.status).json({ message: error.code });
        return;
      }
      throw error;
    }

    runWithTenantContext(
        {
          brandId: resolution.brandId,
          localId: resolution.localId,
          host: host,
          subdomain: resolution.subdomain,
          isPlatform: resolution.isPlatform,
        },
      () => {
        (req as any).tenant = resolution;
        next();
      },
    );
  }
}
