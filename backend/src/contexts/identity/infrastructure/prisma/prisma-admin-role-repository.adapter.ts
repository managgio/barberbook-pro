import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  AdminRoleRepositoryPort,
  CreateAdminRoleInput,
  UpdateAdminRoleInput,
} from '../../ports/outbound/admin-role-repository.port';
import { AdminRoleEntity } from '../../domain/entities/admin-role.entity';

const mapAdminRoleEntity = (role: {
  id: string;
  localId: string;
  name: string;
  description: string | null;
  permissions: unknown;
}): AdminRoleEntity => ({
  id: role.id,
  localId: role.localId,
  name: role.name,
  description: role.description || null,
  permissions: Array.isArray(role.permissions) ? (role.permissions as string[]) : [],
});

@Injectable()
export class PrismaAdminRoleRepositoryAdapter implements AdminRoleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByLocalId(localId: string): Promise<AdminRoleEntity[]> {
    const roles = await this.prisma.adminRole.findMany({
      where: { localId },
      orderBy: { name: 'asc' },
    });
    return roles.map(mapAdminRoleEntity);
  }

  async create(input: CreateAdminRoleInput): Promise<AdminRoleEntity> {
    const created = await this.prisma.adminRole.create({
      data: {
        localId: input.localId,
        name: input.name,
        description: input.description,
        permissions: input.permissions,
      },
    });
    return mapAdminRoleEntity(created);
  }

  async findByIdAndLocalId(params: { id: string; localId: string }): Promise<AdminRoleEntity | null> {
    const found = await this.prisma.adminRole.findFirst({
      where: {
        id: params.id,
        localId: params.localId,
      },
    });
    return found ? mapAdminRoleEntity(found) : null;
  }

  async updateById(id: string, input: UpdateAdminRoleInput): Promise<AdminRoleEntity> {
    const updated = await this.prisma.adminRole.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
      },
    });
    return mapAdminRoleEntity(updated);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.adminRole.delete({ where: { id } });
  }

  async clearRoleAssignments(roleId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { adminRoleId: roleId },
      data: { adminRoleId: null },
    });
  }
}

