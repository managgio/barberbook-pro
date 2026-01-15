import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

@Injectable()
export class AiAssistantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const adminUserId = request.headers['x-admin-user-id'];
    const role = request.headers['x-user-role'];

    if (!adminUserId || typeof adminUserId !== 'string') {
      throw new UnauthorizedException('Se requiere autenticación de administrador.');
    }

    if (role && role !== 'admin') {
      throw new ForbiddenException('Acceso restringido a administradores.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } });
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticación de administrador.');
    }
    if (!user.isSuperAdmin && !user.isPlatformAdmin) {
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
    }

    request.adminUserId = adminUserId;
    return true;
  }
}
