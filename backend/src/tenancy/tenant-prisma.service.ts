import { Inject, Injectable } from '@nestjs/common';
import {
  TENANT_SCOPE_GUARD_BYPASS_PORT,
  TenantScopeGuardBypassPort,
} from '../contexts/platform/ports/outbound/tenant-scope-guard-bypass.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    @Inject(TENANT_SCOPE_GUARD_BYPASS_PORT)
    private readonly tenantScopeGuardBypassPort: TenantScopeGuardBypassPort,
  ) {}

  get client() {
    return this.prisma;
  }

  localWhere<T extends Record<string, unknown>>(where?: T): T & { localId: string } {
    return {
      ...(where || ({} as T)),
      localId: this.tenantContextPort.getRequestContext().localId,
    };
  }

  brandWhere<T extends Record<string, unknown>>(where?: T): T & { brandId: string } {
    return {
      ...(where || ({} as T)),
      brandId: this.tenantContextPort.getRequestContext().brandId,
    };
  }

  localData<T extends Record<string, unknown>>(data: T): T & { localId: string } {
    return {
      ...data,
      localId: this.tenantContextPort.getRequestContext().localId,
    };
  }

  brandData<T extends Record<string, unknown>>(data: T): T & { brandId: string } {
    return {
      ...data,
      brandId: this.tenantContextPort.getRequestContext().brandId,
    };
  }

  async runScopeBypass<T>(fn: () => Promise<T>): Promise<T> {
    return this.tenantScopeGuardBypassPort.runWithScopeGuardBypass(fn);
  }
}
