import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { getCurrentBrandId, getCurrentLocalId, getTenantContext } from '../../tenancy/tenant.context';
import { ObservabilityService } from './observability.service';

@Injectable()
export class ApiMetricsInterceptor implements NestInterceptor {
  constructor(private readonly observability: ObservabilityService) {}

  private resolveStatusCode(error: unknown, fallbackStatus?: unknown) {
    if (typeof (error as { status?: unknown })?.status === 'number') {
      return (error as { status: number }).status;
    }
    if (typeof (error as { statusCode?: unknown })?.statusCode === 'number') {
      return (error as { statusCode: number }).statusCode;
    }
    if (typeof fallbackStatus === 'number') {
      return fallbackStatus;
    }
    return 500;
  }

  private resolveRoute(request: any) {
    const routePath = typeof request?.route?.path === 'string' ? request.route.path : null;
    const baseUrl = typeof request?.baseUrl === 'string' ? request.baseUrl : '';
    const rawPath = routePath ? `${baseUrl}${routePath}` : request?.path || request?.url || request?.originalUrl || 'unknown';
    const [pathOnly] = String(rawPath).split('?');
    return pathOnly || 'unknown';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const originalUrl = String(request?.originalUrl || request?.url || '');
    if (
      originalUrl.startsWith('/api/observability') ||
      originalUrl.startsWith('/api/platform/observability')
    ) {
      return next.handle();
    }

    const startedAt = Date.now();
    const method = String(request?.method || 'GET').toUpperCase();
    const route = this.resolveRoute(request);

    const commit = (statusCode: number) => {
      this.observability.recordApiMetric({
        method,
        route,
        statusCode,
        durationMs: Date.now() - startedAt,
        timestamp: Date.now(),
        localId: getCurrentLocalId(),
        brandId: getCurrentBrandId(),
        subdomain: getTenantContext().subdomain || null,
      });
    };

    return next.handle().pipe(
      tap({
        next: () => commit(typeof response?.statusCode === 'number' ? response.statusCode : 200),
        error: (error) => commit(this.resolveStatusCode(error, response?.statusCode)),
      }),
    );
  }
}
