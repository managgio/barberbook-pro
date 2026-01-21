import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUser } from './users.mapper';
import { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { PLATFORM_ADMIN_EMAILS } from '../../tenancy/tenant.constants';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'admin@barberia.com').toLowerCase();

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  private async applySuperAdminFlag<T extends Partial<CreateUserDto | UpdateUserDto>>(data: T): Promise<T> {
    const email = data.email?.toLowerCase();
    if (!email) return data;

    const brandConfig = await this.tenantConfig.getBrandConfig(getCurrentBrandId());
    const brandSuperAdminEmail = brandConfig.superAdminEmail?.toLowerCase() || SUPER_ADMIN_EMAIL;
    const isBrandSuperAdmin = email === brandSuperAdminEmail;
    const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(email);

    if (isBrandSuperAdmin || isPlatformAdmin) {
      return {
        ...data,
        role: 'admin',
        isSuperAdmin: isBrandSuperAdmin || data.isSuperAdmin || false,
        isPlatformAdmin: isPlatformAdmin || data.isPlatformAdmin || false,
        adminRoleId: null,
      } as T;
    }

    return data;
  }

  private mapPrefs(data: Partial<CreateUserDto | UpdateUserDto>, useDefaults = false) {
    return {
      notificationEmail: data.notificationEmail ?? (useDefaults ? true : undefined),
      notificationWhatsapp: data.notificationWhatsapp ?? (useDefaults ? true : undefined),
      notificationSms: data.notificationSms ?? (useDefaults ? true : undefined),
      prefersBarberSelection: data.prefersBarberSelection ?? (useDefaults ? true : undefined),
    };
  }

  private shouldSyncLocalStaff(data: Partial<CreateUserDto | UpdateUserDto>) {
    return (
      data.role !== undefined ||
      data.adminRoleId !== undefined ||
      data.isSuperAdmin !== undefined ||
      data.isPlatformAdmin !== undefined
    );
  }

  private async ensureBrandMembership(userId: string) {
    const brandId = getCurrentBrandId();
    await this.prisma.brandUser.upsert({
      where: {
        brandId_userId: {
          brandId,
          userId,
        },
      },
      update: {},
      create: {
        brandId,
        userId,
      },
    });
  }

  private async getBrandMembershipStatus(userId: string) {
    const brandId = getCurrentBrandId();
    return this.prisma.brandUser.findUnique({
      where: {
        brandId_userId: {
          brandId,
          userId,
        },
      },
      select: { isBlocked: true },
    });
  }

  private async syncLocalStaffRole(user: Pick<User, 'id' | 'role' | 'isSuperAdmin' | 'isPlatformAdmin' | 'adminRoleId'>) {
    const localId = getCurrentLocalId();
    const isAdmin = user.role === 'admin' || user.isSuperAdmin || user.isPlatformAdmin;
    if (!isAdmin) {
      await this.prisma.locationStaff.deleteMany({
        where: { userId: user.id, localId },
      });
      return;
    }
    await this.prisma.locationStaff.upsert({
      where: {
        localId_userId: {
          localId,
          userId: user.id,
        },
      },
      update: { adminRoleId: user.adminRoleId ?? null },
      create: {
        localId,
        userId: user.id,
        adminRoleId: user.adminRoleId ?? null,
      },
    });
  }

  async findAll() {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const users = await this.prisma.user.findMany({
      where: { brandMemberships: { some: { brandId } } },
      include: {
        brandMemberships: {
          where: { brandId },
          select: { isBlocked: true },
          take: 1,
        },
        localStaffRoles: {
          where: { localId },
          select: { adminRoleId: true },
          take: 1,
        },
      },
    });
    return users.map((user) =>
      mapUser(user, {
        adminRoleId: user.localStaffRoles[0]?.adminRoleId ?? null,
        isLocalAdmin: user.localStaffRoles.length > 0,
        isBlocked: user.brandMemberships[0]?.isBlocked ?? false,
      }),
    );
  }

  async findOne(id: string) {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const user = await this.prisma.user.findFirst({
      where: { id, brandMemberships: { some: { brandId } } },
      include: {
        brandMemberships: {
          where: { brandId },
          select: { isBlocked: true },
          take: 1,
        },
        localStaffRoles: {
          where: { localId },
          select: { adminRoleId: true },
          take: 1,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return mapUser(user, {
      adminRoleId: user.localStaffRoles[0]?.adminRoleId ?? null,
      isLocalAdmin: user.localStaffRoles.length > 0,
      isBlocked: user.brandMemberships[0]?.isBlocked ?? false,
    });
  }

  async findByEmail(email: string) {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), brandMemberships: { some: { brandId } } },
      include: {
        brandMemberships: {
          where: { brandId },
          select: { isBlocked: true },
          take: 1,
        },
        localStaffRoles: {
          where: { localId },
          select: { adminRoleId: true },
          take: 1,
        },
      },
    });
    if (user?.brandMemberships[0]?.isBlocked) {
      throw new ForbiddenException('Usuario bloqueado');
    }
    return user
      ? mapUser(user, {
          adminRoleId: user.localStaffRoles[0]?.adminRoleId ?? null,
          isLocalAdmin: user.localStaffRoles.length > 0,
          isBlocked: user.brandMemberships[0]?.isBlocked ?? false,
        })
      : null;
  }

  async findByFirebaseUid(firebaseUid: string) {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const user = await this.prisma.user.findFirst({
      where: { firebaseUid, brandMemberships: { some: { brandId } } },
      include: {
        brandMemberships: {
          where: { brandId },
          select: { isBlocked: true },
          take: 1,
        },
        localStaffRoles: {
          where: { localId },
          select: { adminRoleId: true },
          take: 1,
        },
      },
    });
    if (user?.brandMemberships[0]?.isBlocked) {
      throw new ForbiddenException('Usuario bloqueado');
    }
    return user
      ? mapUser(user, {
          adminRoleId: user.localStaffRoles[0]?.adminRoleId ?? null,
          isLocalAdmin: user.localStaffRoles.length > 0,
          isBlocked: user.brandMemberships[0]?.isBlocked ?? false,
        })
      : null;
  }

  async create(data: CreateUserDto) {
    const payload = await this.applySuperAdminFlag(data);
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
          isPlatformAdmin: payload.isPlatformAdmin ?? false,
          ...this.mapPrefs(payload, true),
        },
      });
      await this.ensureBrandMembership(created.id);
      if (this.shouldSyncLocalStaff(payload)) {
        await this.syncLocalStaffRole(created);
      }
      const brandMembership = await this.getBrandMembershipStatus(created.id);
      const localId = getCurrentLocalId();
      const localStaff = await this.prisma.locationStaff.findUnique({
        where: { localId_userId: { localId, userId: created.id } },
        select: { adminRoleId: true },
      });
      return mapUser(created, {
        adminRoleId: localStaff?.adminRoleId ?? null,
        isLocalAdmin: Boolean(localStaff),
        isBlocked: brandMembership?.isBlocked ?? false,
      });
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
            isPlatformAdmin: payload.isPlatformAdmin ?? existing.isPlatformAdmin,
            ...this.mapPrefs(payload, false),
          },
        });
        await this.ensureBrandMembership(updated.id);
        if (this.shouldSyncLocalStaff(payload)) {
          await this.syncLocalStaffRole(updated);
        }
        const brandMembership = await this.getBrandMembershipStatus(updated.id);
        const localId = getCurrentLocalId();
        const localStaff = await this.prisma.locationStaff.findUnique({
          where: { localId_userId: { localId, userId: updated.id } },
          select: { adminRoleId: true },
        });
        return mapUser(updated, {
          adminRoleId: localStaff?.adminRoleId ?? null,
          isLocalAdmin: Boolean(localStaff),
          isBlocked: brandMembership?.isBlocked ?? false,
        });
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateUserDto) {
    const payload = await this.applySuperAdminFlag(data);
    const shouldSyncLocalRole = this.shouldSyncLocalStaff(payload);
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
          isPlatformAdmin: payload.isPlatformAdmin,
          ...this.mapPrefs(payload, false),
        },
      });
    } catch (error) {
      throw new NotFoundException('User not found');
    }
    await this.ensureBrandMembership(updated.id);
    if (shouldSyncLocalRole) {
      await this.syncLocalStaffRole(updated);
    }
    const brandMembership = await this.getBrandMembershipStatus(updated.id);
    const localId = getCurrentLocalId();
    const localStaff = await this.prisma.locationStaff.findUnique({
      where: { localId_userId: { localId, userId: updated.id } },
      select: { adminRoleId: true },
    });
    return mapUser(updated, {
      adminRoleId: localStaff?.adminRoleId ?? null,
      isLocalAdmin: Boolean(localStaff),
      isBlocked: brandMembership?.isBlocked ?? false,
    });
  }

  async setBrandBlockStatus(userId: string, isBlocked: boolean) {
    const brandId = getCurrentBrandId();
    const membership = await this.prisma.brandUser.findUnique({
      where: {
        brandId_userId: {
          brandId,
          userId,
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.brandUser.update({
      where: {
        brandId_userId: {
          brandId,
          userId,
        },
      },
      data: { isBlocked },
    });
    return this.findOne(userId);
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    if (existing.firebaseUid) {
      try {
        await this.firebaseAdmin.deleteUser(existing.firebaseUid);
      } catch (error) {
        this.logger?.warn?.(`No se pudo eliminar en Firebase Auth (${existing.firebaseUid}): ${error}`);
      }
    }

    await this.prisma.$transaction([
      this.prisma.appointment.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    return { success: true };
  }
}
