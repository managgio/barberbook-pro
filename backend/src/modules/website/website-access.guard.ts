import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuthService } from '../../auth/auth.service';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { isWebsiteEnabled } from '../../contexts/platform/domain/services/website-media.policy';
import { PrismaService } from '../../prisma/prisma.service';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantConfigService } from '../../tenancy/tenant-config.service';

@Injectable()
export class WebsiteAccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService,
    private readonly config: TenantConfigService, @Inject(TENANT_CONTEXT_PORT) private readonly context: TenantContextPort) {}
  async canActivate(execution: ExecutionContext) {
    const request = execution.switchToHttp().getRequest();
    const user = await this.auth.requireUser(request);
    const config = await this.config.getEffectiveConfig();
    if (!isWebsiteEnabled(config)) throw new ForbiddenException('WEBSITE_DISABLED');
    if (user.isPlatformAdmin) return true;
    const { localId } = this.context.getRequestContext();
    const staff = await this.prisma.locationStaff.findUnique({ where: { localId_userId: { localId, userId: user.id } }, select: { adminRoleId: true, adminRole: { select: { localId: true, permissions: true } } } });
    if (!staff || (staff.adminRoleId && (staff.adminRole?.localId !== localId || !Array.isArray(staff.adminRole?.permissions) || !staff.adminRole.permissions.includes('website')))) {
      throw new ForbiddenException('WEBSITE_ACCESS_DENIED');
    }
    return true;
  }
}

@Module({ imports: [AuthModule, TenancyModule], providers: [WebsiteAccessGuard], exports: [WebsiteAccessGuard, AuthModule, TenancyModule] })
export class WebsiteAccessModule {}
