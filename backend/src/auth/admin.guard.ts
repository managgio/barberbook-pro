import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../contexts/platform/ports/outbound/tenant-context.port';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ENDPOINT_KEY } from './admin.decorator';
import { AuthService } from './auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAdminEndpoint = this.reflector.getAllAndOverride<boolean>(ADMIN_ENDPOINT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isAdminEndpoint) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = await this.authService.requireUser(request);
    const adminUserId = user.id;

    if (user.isSuperAdmin || user.isPlatformAdmin) {
      request.adminUserId = adminUserId;
      return true;
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Acceso restringido a administradores.');
    }

    const localId = this.tenantContextPort.getRequestContext().localId;
    const staff = await this.prisma.locationStaff.findUnique({
      where: {
        localId_userId: {
          localId,
          userId: adminUserId,
        },
      },
    });

    if (!staff) {
      throw new ForbiddenException('Acceso restringido al administrador del local.');
    }

    request.adminUserId = adminUserId;
    return true;
  }
}
