import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_BRAND_ID,
  DEFAULT_BRAND_SUBDOMAIN,
  DEFAULT_LOCAL_ID,
  PLATFORM_SUBDOMAIN,
  TENANT_BASE_DOMAIN,
  TENANT_REQUIRE_SUBDOMAIN,
} from './tenant.constants';

type TenantResolution = {
  brandId: string;
  localId: string;
  subdomain?: string | null;
  isPlatform?: boolean;
};

export class TenantResolutionError extends Error {
  status: number;
  code: string;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const normalizeHost = (host?: string | string[]) => {
  if (!host) return '';
  const raw = Array.isArray(host) ? host[0] : host;
  return raw.split(':')[0].trim().toLowerCase();
};

const resolveSubdomain = (hostname: string) => {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  if (hostname === TENANT_BASE_DOMAIN) return null;
  if (hostname.endsWith(`.${TENANT_BASE_DOMAIN}`)) {
    const prefix = hostname.slice(0, -(TENANT_BASE_DOMAIN.length + 1));
    const parts = prefix.split('.');
    return parts[0] || null;
  }
  return null;
};

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTenant(params: {
    host?: string | string[];
    subdomainOverride?: string | null;
    localIdOverride?: string | null;
  }): Promise<TenantResolution> {
    const hostname = normalizeHost(params.host);
    const subdomain = params.subdomainOverride?.trim().toLowerCase() || resolveSubdomain(hostname);
    const isPlatform = Boolean(subdomain && subdomain === PLATFORM_SUBDOMAIN);
    const requireSubdomain = TENANT_REQUIRE_SUBDOMAIN;

    let brand =
      (!isPlatform && subdomain
        ? await this.prisma.brand.findFirst({
            where: { subdomain },
            select: { id: true, defaultLocationId: true },
          })
        : null) ||
      (hostname
        ? await this.prisma.brand.findFirst({
            where: { customDomain: hostname },
            select: { id: true, defaultLocationId: true },
          })
        : null);

    if (!isPlatform && requireSubdomain) {
      if (subdomain && !brand) {
        throw new TenantResolutionError('TENANT_NOT_FOUND', 404);
      }
      if (!subdomain && !brand) {
        throw new TenantResolutionError('TENANT_SUBDOMAIN_REQUIRED', 400);
      }
    }

    if (!brand) {
      brand =
        (await this.prisma.brand.findUnique({
          where: { id: DEFAULT_BRAND_ID },
          select: { id: true, defaultLocationId: true },
        })) ||
        (await this.prisma.brand.findFirst({
          where: { subdomain: DEFAULT_BRAND_SUBDOMAIN },
          select: { id: true, defaultLocationId: true },
        }));
    }

    if (!brand) {
      throw new TenantResolutionError('TENANT_NOT_BOOTSTRAPPED', 500);
    }

    const brandId = brand.id;
    const localOverride = params.localIdOverride?.trim() || null;

    const preferredLocalId =
      localOverride ||
      brand.defaultLocationId ||
      DEFAULT_LOCAL_ID;

    const location =
      (preferredLocalId
        ? await this.prisma.location.findFirst({
            where: { id: preferredLocalId, brandId },
            select: { id: true },
          })
        : null) ||
      (await this.prisma.location.findFirst({
        where: { brandId, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })) ||
      (await this.prisma.location.findFirst({
        where: { brandId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }));

    if (!location) {
      throw new TenantResolutionError('TENANT_LOCATION_NOT_FOUND', 500);
    }

    return {
      brandId,
      localId: location.id,
      subdomain,
      isPlatform,
    };
  }
}
