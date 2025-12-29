import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { mapRole } from './roles.mapper';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.adminRole.findMany({ orderBy: { name: 'asc' } });
    return roles.map(mapRole);
  }

  async create(data: CreateRoleDto) {
    const created = await this.prisma.adminRole.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
      },
    });
    return mapRole(created);
  }

  async update(id: string, data: UpdateRoleDto) {
    try {
      const updated = await this.prisma.adminRole.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          permissions: data.permissions,
        },
      });
      return mapRole(updated);
    } catch (error) {
      throw new NotFoundException('Role not found');
    }
  }

  async remove(id: string) {
    await this.prisma.adminRole.delete({ where: { id } });
    await this.prisma.user.updateMany({
      where: { adminRoleId: id },
      data: { adminRoleId: null },
    });
    return { success: true };
  }
}
