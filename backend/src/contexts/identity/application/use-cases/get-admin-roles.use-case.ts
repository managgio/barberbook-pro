import { AdminRoleRepositoryPort } from '../../ports/outbound/admin-role-repository.port';
import { GetAdminRolesQuery } from '../queries/get-admin-roles.query';

export class GetAdminRolesUseCase {
  constructor(private readonly adminRoleRepositoryPort: AdminRoleRepositoryPort) {}

  execute(query: GetAdminRolesQuery) {
    return this.adminRoleRepositoryPort.listByLocalId(query.context.localId);
  }
}

