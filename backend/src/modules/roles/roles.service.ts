import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAdminRoleUseCase } from '../../contexts/identity/application/use-cases/create-admin-role.use-case';
import { GetAdminRolesUseCase } from '../../contexts/identity/application/use-cases/get-admin-roles.use-case';
import { RemoveAdminRoleUseCase } from '../../contexts/identity/application/use-cases/remove-admin-role.use-case';
import { UpdateAdminRoleUseCase } from '../../contexts/identity/application/use-cases/update-admin-role.use-case';
import {
  AdminRoleRepositoryPort,
  IDENTITY_ADMIN_ROLE_REPOSITORY_PORT,
} from '../../contexts/identity/ports/outbound/admin-role-repository.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { mapRole } from './roles.mapper';

@Injectable()
export class RolesService {
  private readonly getAdminRolesUseCase: GetAdminRolesUseCase;
  private readonly createAdminRoleUseCase: CreateAdminRoleUseCase;
  private readonly updateAdminRoleUseCase: UpdateAdminRoleUseCase;
  private readonly removeAdminRoleUseCase: RemoveAdminRoleUseCase;

  constructor(
    @Inject(IDENTITY_ADMIN_ROLE_REPOSITORY_PORT)
    private readonly adminRoleRepositoryPort: AdminRoleRepositoryPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getAdminRolesUseCase = new GetAdminRolesUseCase(this.adminRoleRepositoryPort);
    this.createAdminRoleUseCase = new CreateAdminRoleUseCase(this.adminRoleRepositoryPort);
    this.updateAdminRoleUseCase = new UpdateAdminRoleUseCase(this.adminRoleRepositoryPort);
    this.removeAdminRoleUseCase = new RemoveAdminRoleUseCase(this.adminRoleRepositoryPort);
  }

  async findAll() {
    const roles = await this.getAdminRolesUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
    });
    return roles.map(mapRole);
  }

  async create(data: CreateRoleDto) {
    const created = await this.createAdminRoleUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      name: data.name,
      description: data.description,
      permissions: data.permissions,
    });
    return mapRole(created);
  }

  async update(id: string, data: UpdateRoleDto) {
    try {
      const updated = await this.updateAdminRoleUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        roleId: id,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
      });
      return mapRole(updated);
    } catch (error) {
      this.rethrowRoleNotFound(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.removeAdminRoleUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        roleId: id,
      });
      return { success: true };
    } catch (error) {
      this.rethrowRoleNotFound(error);
      throw error;
    }
  }

  private rethrowRoleNotFound(error: unknown): never | void {
    rethrowDomainErrorAsHttp(error, {
      ROLE_NOT_FOUND: () => new NotFoundException('Role not found'),
    });
  }
}
