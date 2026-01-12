import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AiAssistantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminUserId = request.headers['x-admin-user-id'];
    const role = request.headers['x-user-role'];

    if (!adminUserId || typeof adminUserId !== 'string') {
      throw new UnauthorizedException('Se requiere autenticación de administrador.');
    }

    if (role && role !== 'admin') {
      throw new ForbiddenException('Acceso restringido a administradores.');
    }

    request.adminUserId = adminUserId;
    return true;
  }
}
