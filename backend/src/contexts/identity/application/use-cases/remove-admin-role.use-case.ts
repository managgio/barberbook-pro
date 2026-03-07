import { DomainError } from '../../../../shared/domain/domain-error';
import { AdminRoleRepositoryPort } from '../../ports/outbound/admin-role-repository.port';
import { RemoveAdminRoleCommand } from '../commands/remove-admin-role.command';

export class RemoveAdminRoleUseCase {
  constructor(private readonly adminRoleRepositoryPort: AdminRoleRepositoryPort) {}

  async execute(command: RemoveAdminRoleCommand) {
    const existing = await this.adminRoleRepositoryPort.findByIdAndLocalId({
      id: command.roleId,
      localId: command.context.localId,
    });
    if (!existing) {
      throw new DomainError('Role not found', 'ROLE_NOT_FOUND');
    }

    await this.adminRoleRepositoryPort.deleteById(command.roleId);
    await this.adminRoleRepositoryPort.clearRoleAssignments(command.roleId);
  }
}

