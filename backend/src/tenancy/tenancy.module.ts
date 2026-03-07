import { Module } from '@nestjs/common';
import { AlsTenantContextAdapter } from '../contexts/platform/infrastructure/adapters/als-tenant-context.adapter';
import { AlsTenantContextRunnerAdapter } from '../contexts/platform/infrastructure/adapters/als-tenant-context-runner.adapter';
import { AlsTenantScopeGuardBypassAdapter } from '../contexts/platform/infrastructure/adapters/als-tenant-scope-guard-bypass.adapter';
import { ACTIVE_LOCATION_ITERATOR_PROVIDER } from '../contexts/platform/infrastructure/adapters/prisma-active-location-iterator.adapter';
import { ACTIVE_LOCATION_ITERATOR_PORT } from '../contexts/platform/ports/outbound/active-location-iterator.port';
import { TENANT_CONTEXT_RUNNER_PORT } from '../contexts/platform/ports/outbound/tenant-context-runner.port';
import { TENANT_SCOPE_GUARD_BYPASS_PORT } from '../contexts/platform/ports/outbound/tenant-scope-guard-bypass.port';
import { TENANT_CONTEXT_PORT } from '../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaModule } from '../prisma/prisma.module';
import { TENANT_CONFIG_READ_PORT } from '../shared/application/tenant-config-read.port';
import { TenantService } from './tenant.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantController } from './tenant.controller';
import { TenantPrismaService } from './tenant-prisma.service';
import { TenantConfigReadAdapter } from './adapters/tenant-config-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: TENANT_CONTEXT_PORT, useClass: AlsTenantContextAdapter },
    { provide: TENANT_CONTEXT_RUNNER_PORT, useClass: AlsTenantContextRunnerAdapter },
    { provide: TENANT_SCOPE_GUARD_BYPASS_PORT, useClass: AlsTenantScopeGuardBypassAdapter },
    ACTIVE_LOCATION_ITERATOR_PROVIDER,
    TenantService,
    TenantConfigService,
    TenantConfigReadAdapter,
    TenantPrismaService,
    { provide: TENANT_CONFIG_READ_PORT, useExisting: TenantConfigReadAdapter },
  ],
  controllers: [TenantController],
  exports: [
    TenantService,
    TenantConfigService,
    TenantPrismaService,
    TENANT_CONFIG_READ_PORT,
    TENANT_CONTEXT_PORT,
    TENANT_CONTEXT_RUNNER_PORT,
    TENANT_SCOPE_GUARD_BYPASS_PORT,
    ACTIVE_LOCATION_ITERATOR_PORT,
  ],
})
export class TenancyModule {}
