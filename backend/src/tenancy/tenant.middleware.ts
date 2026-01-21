import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { runWithTenantContext } from './tenant.context';
import { TenantResolutionError, TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, _res: Response, next: () => void) {
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
