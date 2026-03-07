import { AdminRoleEntity } from '../../domain/entities/admin-role.entity';

export const IDENTITY_ADMIN_ROLE_REPOSITORY_PORT = Symbol('IDENTITY_ADMIN_ROLE_REPOSITORY_PORT');

export type CreateAdminRoleInput = {
  localId: string;
  name: string;
  description?: string;
  permissions: string[];
};

export type UpdateAdminRoleInput = {
  name?: string;
  description?: string;
  permissions?: string[];
};

export interface AdminRoleRepositoryPort {
  listByLocalId(localId: string): Promise<AdminRoleEntity[]>;
  create(input: CreateAdminRoleInput): Promise<AdminRoleEntity>;
  findByIdAndLocalId(params: { id: string; localId: string }): Promise<AdminRoleEntity | null>;
  updateById(id: string, input: UpdateAdminRoleInput): Promise<AdminRoleEntity>;
  deleteById(id: string): Promise<void>;
  clearRoleAssignments(roleId: string): Promise<void>;
}

