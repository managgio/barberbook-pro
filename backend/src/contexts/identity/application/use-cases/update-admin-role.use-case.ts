import { DomainError } from '../../../../shared/domain/domain-error';
import { AdminRoleRepositoryPort } from '../../ports/outbound/admin-role-repository.port';
import { UpdateAdminRoleCommand } from '../commands/update-admin-role.command';

export class UpdateAdminRoleUseCase {
  constructor(private readonly adminRoleRepositoryPort: AdminRoleRepositoryPort) {}

  async execute(command: UpdateAdminRoleCommand) {
    const existing = await this.adminRoleRepositoryPort.findByIdAndLocalId({
      id: command.roleId,
      localId: command.context.localId,
    });
    if (!existing) {
      throw new DomainError('Role not found', 'ROLE_NOT_FOUND');
    }

    return this.adminRoleRepositoryPort.updateById(command.roleId, {
      name: command.name,
      description: command.description,
      permissions: command.permissions,
    });
  }
}

