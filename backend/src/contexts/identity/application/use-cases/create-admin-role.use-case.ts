import { AdminRoleRepositoryPort } from '../../ports/outbound/admin-role-repository.port';
import { CreateAdminRoleCommand } from '../commands/create-admin-role.command';

export class CreateAdminRoleUseCase {
  constructor(private readonly adminRoleRepositoryPort: AdminRoleRepositoryPort) {}

  execute(command: CreateAdminRoleCommand) {
    return this.adminRoleRepositoryPort.create({
      localId: command.context.localId,
      name: command.name,
      description: command.description,
      permissions: command.permissions,
    });
  }
}

