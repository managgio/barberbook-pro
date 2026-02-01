import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { runWithTenantContext } from './tenant.context';
import { TenantResolutionError, TenantService } from './tenant.service';
import { DEFAULT_BRAND_ID, DEFAULT_LOCAL_ID } from './tenant.constants';

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
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const subdomainOverride = typeof req.headers['x-tenant-subdomain'] === 'string'
      ? req.headers['x-tenant-subdomain']
      : null;
    const localIdOverride = typeof req.headers['x-local-id'] === 'string'
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
        host: typeof host === 'string' ? host : Array.isArray(host) ? host[0] : undefined,
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
