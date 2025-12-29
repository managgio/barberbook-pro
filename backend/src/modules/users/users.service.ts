import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUser } from './users.mapper';
import { User } from '@prisma/client';

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'admin@barberia.com').toLowerCase();

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private applySuperAdminFlag<T extends Partial<CreateUserDto | UpdateUserDto>>(data: T): T {
    if (data.email && data.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
      return {
        ...data,
        role: 'admin',
        isSuperAdmin: true,
        adminRoleId: null,
      } as T;
    }
    return data;
  }

  private mapPrefs(data: Partial<CreateUserDto | UpdateUserDto>, useDefaults = false) {
    return {
      notificationEmail: data.notificationEmail ?? (useDefaults ? true : undefined),
      notificationWhatsapp: data.notificationWhatsapp ?? (useDefaults ? false : undefined),
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map(mapUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return mapUser(user);
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? mapUser(user) : null;
  }

  async findByFirebaseUid(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    return user ? mapUser(user) : null;
  }

  async create(data: CreateUserDto) {
    const payload = this.applySuperAdminFlag(data);
    const created = await this.prisma.user.create({
      data: {
        firebaseUid: payload.firebaseUid,
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        role: payload.role || 'client',
        avatar: payload.avatar,
        adminRoleId: payload.adminRoleId ?? null,
        isSuperAdmin: payload.isSuperAdmin ?? false,
        ...this.mapPrefs(payload, true),
      },
    });
    return mapUser(created);
  }

  async update(id: string, data: UpdateUserDto) {
    const payload = this.applySuperAdminFlag(data);
    let updated: User;
    try {
      updated = await this.prisma.user.update({
        where: { id },
        data: {
          firebaseUid: payload.firebaseUid,
          name: payload.name,
          email: payload.email?.toLowerCase(),
          phone: payload.phone,
          role: payload.role,
          avatar: payload.avatar,
          adminRoleId: payload.adminRoleId,
          isSuperAdmin: payload.isSuperAdmin,
          ...this.mapPrefs(payload, false),
        },
      });
    } catch (error) {
      throw new NotFoundException('User not found');
    }
    return mapUser(updated);
  }
}
