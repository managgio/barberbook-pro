import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import {
  AI_ADMIN_ACCESS_READ_PORT,
  AiAdminAccessReadPort,
} from '../../contexts/ai-orchestration/ports/outbound/ai-admin-access-read.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';

@Injectable()
export class AiAssistantGuard implements CanActivate {
  constructor(
    @Inject(AI_ADMIN_ACCESS_READ_PORT)
    private readonly adminAccessReadPort: AiAdminAccessReadPort,
    private readonly authService: AuthService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.authService.requireUser(request);
    const adminUserId = user.id;
    if (!user.isSuperAdmin && !user.isPlatformAdmin) {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Acceso restringido a administradores.');
      }
      const localId = this.tenantContextPort.getRequestContext().localId;
      const hasStaffMembership = await this.adminAccessReadPort.hasLocationStaffMembership({
        localId,
        userId: adminUserId,
      });
      if (!hasStaffMembership) {
        throw new ForbiddenException('Acceso restringido al administrador del local.');
      }
    }

    request.adminUserId = adminUserId;
    return true;
  }
}
