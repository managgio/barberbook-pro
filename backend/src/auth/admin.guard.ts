import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ENDPOINT_KEY } from './admin.decorator';
import { getCurrentLocalId } from '../tenancy/tenant.context';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
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
    const adminUserId = request.headers['x-admin-user-id'];

    if (!adminUserId || typeof adminUserId !== 'string') {
      throw new UnauthorizedException('Se requiere autenticación de administrador.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } });
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticación de administrador.');
    }

    if (user.isSuperAdmin || user.isPlatformAdmin) {
      request.adminUserId = adminUserId;
      return true;
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Acceso restringido a administradores.');
    }

    const localId = getCurrentLocalId();
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
