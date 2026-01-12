import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUser } from './users.mapper';
import { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getAdminAuth } from '../../lib/firebaseAdmin';

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'admin@barberia.com').toLowerCase();

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
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
      notificationWhatsapp: data.notificationWhatsapp ?? (useDefaults ? true : undefined),
      prefersBarberSelection: data.prefersBarberSelection ?? (useDefaults ? true : undefined),
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
    try {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        payload.email
      ) {
        const email = payload.email.toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (!existing) {
          throw error;
        }
        const updated = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            firebaseUid: payload.firebaseUid ?? existing.firebaseUid,
            name: payload.name ?? existing.name,
            email,
            phone: payload.phone ?? existing.phone,
            role: payload.role ?? existing.role,
            avatar: payload.avatar ?? existing.avatar,
            adminRoleId: payload.adminRoleId ?? existing.adminRoleId,
            isSuperAdmin: payload.isSuperAdmin ?? existing.isSuperAdmin,
            ...this.mapPrefs(payload, false),
          },
        });
        return mapUser(updated);
      }
      throw error;
    }
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

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    if (existing.firebaseUid) {
      const adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          await adminAuth.deleteUser(existing.firebaseUid);
        } catch (error) {
          this.logger?.warn?.(`No se pudo eliminar en Firebase Auth (${existing.firebaseUid}): ${error}`);
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.appointment.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    return { success: true };
  }
}
