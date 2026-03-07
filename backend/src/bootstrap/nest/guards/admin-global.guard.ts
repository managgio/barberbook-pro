import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../../../auth/admin.guard';
import { AuthService } from '../../../auth/auth.service';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminGlobalGuard extends AdminGuard {
  constructor(
    reflector: Reflector,
    prisma: PrismaService,
    authService: AuthService,
    @Inject(TENANT_CONTEXT_PORT)
    tenantContextPort: TenantContextPort,
  ) {
    super(reflector, prisma, authService, tenantContextPort);
  }
}
