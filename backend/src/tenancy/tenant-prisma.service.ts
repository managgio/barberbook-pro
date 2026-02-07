import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getCurrentBrandId,
  getCurrentLocalId,
  runWithTenantScopeGuardBypassAsync,
} from './tenant.context';

@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  localWhere<T extends Record<string, unknown>>(where?: T): T & { localId: string } {
    return {
      ...(where || ({} as T)),
      localId: getCurrentLocalId(),
    };
  }

  brandWhere<T extends Record<string, unknown>>(where?: T): T & { brandId: string } {
    return {
      ...(where || ({} as T)),
      brandId: getCurrentBrandId(),
    };
  }

  localData<T extends Record<string, unknown>>(data: T): T & { localId: string } {
    return {
      ...data,
      localId: getCurrentLocalId(),
    };
  }

  brandData<T extends Record<string, unknown>>(data: T): T & { brandId: string } {
    return {
      ...data,
      brandId: getCurrentBrandId(),
    };
  }

  async runScopeBypass<T>(fn: () => Promise<T>): Promise<T> {
    return runWithTenantScopeGuardBypassAsync(fn);
  }
}

