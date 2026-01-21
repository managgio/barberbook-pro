import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { mapRole } from './roles.mapper';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const localId = getCurrentLocalId();
    const roles = await this.prisma.adminRole.findMany({
      where: { localId },
      orderBy: { name: 'asc' },
    });
    return roles.map(mapRole);
  }

  async create(data: CreateRoleDto) {
    const localId = getCurrentLocalId();
    const created = await this.prisma.adminRole.create({
      data: {
        localId,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
      },
    });
    return mapRole(created);
  }

  async update(id: string, data: UpdateRoleDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.adminRole.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Role not found');

    const updated = await this.prisma.adminRole.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
      },
    });
    return mapRole(updated);
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.adminRole.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Role not found');
    await this.prisma.adminRole.delete({ where: { id } });
    await this.prisma.user.updateMany({
      where: { adminRoleId: id },
      data: { adminRoleId: null },
    });
    return { success: true };
  }
}
