import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const adminUserId = request.headers['x-admin-user-id'];

    if (!adminUserId || typeof adminUserId !== 'string') {
      throw new UnauthorizedException('Se requiere autenticación de plataforma.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } });
    if (!user || !user.isPlatformAdmin) {
      throw new ForbiddenException('Acceso restringido a plataforma.');
    }

    request.platformUserId = adminUserId;
    return true;
  }
}
