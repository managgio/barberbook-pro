import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

@Injectable()
export class AiAssistantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.authService.requireUser(request);
    const adminUserId = user.id;
    if (!user.isSuperAdmin && !user.isPlatformAdmin) {
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
    }

    request.adminUserId = adminUserId;
    return true;
  }
}
