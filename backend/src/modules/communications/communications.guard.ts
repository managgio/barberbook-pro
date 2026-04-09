import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '../../contexts/platform/ports/outbound/tenant-context.port';
import { COMMUNICATION_PERMISSION_KEY } from './communications-permission.decorator';
import { CommunicationPermissionKey } from './communications.constants';

@Injectable()
export class CommunicationsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly tenantConfigService: TenantConfigService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.authService.requireUser(request);
    request.adminUserId = user.id;

    const featureEnabled = await this.isFeatureEnabled();
    if (!featureEnabled) {
      throw new NotFoundException('Comunicados no está disponible en este local.');
    }

    if (user.isSuperAdmin || user.isPlatformAdmin) {
      return true;
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Acceso restringido a administradores.');
    }

    const localId = this.tenantContextPort.getRequestContext().localId;
    const staffMembership = await this.prisma.locationStaff.findUnique({
      where: {
        localId_userId: {
          localId,
          userId: user.id,
        },
      },
      select: {
        adminRoleId: true,
      },
    });

    if (!staffMembership) {
      throw new ForbiddenException('Acceso restringido al administrador del local.');
    }

    const requiredPermission = this.reflector.getAllAndOverride<CommunicationPermissionKey>(
      COMMUNICATION_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const dynamicPermissions = this.resolveDynamicPermissions(request);
    const requiredPermissions = [requiredPermission, ...dynamicPermissions].filter(Boolean) as CommunicationPermissionKey[];
    if (requiredPermissions.length === 0) return true;

    if (!staffMembership.adminRoleId) {
      return true;
    }

    const role = await this.prisma.adminRole.findFirst({
      where: { id: staffMembership.adminRoleId, localId },
      select: { permissions: true },
    });
    const permissions = Array.isArray(role?.permissions) ? (role?.permissions as string[]) : [];
    const allowed = requiredPermissions.every((permission) => this.hasPermission(permissions, permission));
    if (allowed) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos para esta acción en Comunicados.');
  }

  private async isFeatureEnabled() {
    const config = await this.tenantConfigService.getEffectiveConfig();
    return config.features?.communicationsEnabled === true;
  }

  private hasPermission(permissions: string[], requiredPermission: CommunicationPermissionKey) {
    if (permissions.includes(requiredPermission)) return true;
    if (
      (requiredPermission === 'communications:view' || requiredPermission === 'communications:view_history') &&
      permissions.includes('communications')
    ) {
      return true;
    }
    return false;
  }

  private resolveDynamicPermissions(
    request: { method?: string; originalUrl?: string; url?: string; body?: Record<string, unknown> },
  ): CommunicationPermissionKey[] {
    const method = (request.method || '').toUpperCase();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const body = (request.body || {}) as Record<string, unknown>;
    const permissions: CommunicationPermissionKey[] = [];

    if (method === 'POST' && path.endsWith('/admin/communications')) {
      const saveAsDraft = body.saveAsDraft === true;
      const scheduleAt = typeof body.scheduleAt === 'string' ? body.scheduleAt.trim() : '';
      const executeNow = body.executeNow !== false;
      if (!saveAsDraft && scheduleAt) {
        permissions.push('communications:schedule');
      } else if (!saveAsDraft && executeNow) {
        permissions.push('communications:execute');
      }
    }

    if (method === 'PATCH' && path.endsWith('/draft')) {
      const scheduleAt = typeof body.scheduleAt === 'string' ? body.scheduleAt.trim() : '';
      if (scheduleAt) {
        permissions.push('communications:schedule');
      }
    }

    return permissions;
  }
}
