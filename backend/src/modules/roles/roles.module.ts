import { Module } from '@nestjs/common';
import { PrismaAdminRoleRepositoryAdapter } from '../../contexts/identity/infrastructure/prisma/prisma-admin-role-repository.adapter';
import { IDENTITY_ADMIN_ROLE_REPOSITORY_PORT } from '../../contexts/identity/ports/outbound/admin-role-repository.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TenancyModule],
  controllers: [RolesController],
  providers: [
    RolesService,
    PrismaAdminRoleRepositoryAdapter,
    {
      provide: IDENTITY_ADMIN_ROLE_REPOSITORY_PORT,
      useExisting: PrismaAdminRoleRepositoryAdapter,
    },
  ],
  exports: [RolesService],
})
export class RolesModule {}
