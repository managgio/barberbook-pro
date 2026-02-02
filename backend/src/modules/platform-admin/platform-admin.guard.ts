import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.authService.requireUser(request);
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Acceso restringido a plataforma.');
    }

    request.platformUserId = user.id;
    return true;
  }
}
