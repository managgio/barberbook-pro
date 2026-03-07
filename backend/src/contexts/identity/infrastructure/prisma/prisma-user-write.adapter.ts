import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TenantConfigService } from '../../../../tenancy/tenant-config.service';
import { PLATFORM_ADMIN_EMAILS } from '../../../../tenancy/tenant.constants';
import { IdentityUserAccessRecord, IdentityUserRole } from '../../domain/entities/user-access.entity';
import {
  CreateIdentityUserInput,
  RemoveIdentityUserResult,
  UpdateIdentityUserInput,
  UserWritePort,
} from '../../ports/outbound/user-write.port';

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'c.lopemonre@gmail.com').toLowerCase();

@Injectable()
export class PrismaUserWriteAdapter implements UserWritePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async create(params: {
    brandId: string;
    localId: string;
    input: CreateIdentityUserInput;
  }): Promise<IdentityUserAccessRecord> {
    const payload = await this.applySuperAdminFlag(params.brandId, params.input);

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

      await this.ensureBrandMembership(params.brandId, created.id);
      if (this.shouldSyncLocalStaff(payload)) {
        await this.syncLocalStaffRole(params.localId, created);
      }

      return this.mapUserAccessRecord({
        brandId: params.brandId,
        localId: params.localId,
        user: created,
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

        await this.ensureBrandMembership(params.brandId, updated.id);
        if (this.shouldSyncLocalStaff(payload)) {
          await this.syncLocalStaffRole(params.localId, updated);
        }

        return this.mapUserAccessRecord({
          brandId: params.brandId,
          localId: params.localId,
          user: updated,
        });
      }

      throw error;
    }
  }

  async update(params: {
    brandId: string;
    localId: string;
    userId: string;
    input: UpdateIdentityUserInput;
  }): Promise<IdentityUserAccessRecord | null> {
    const existing = await this.prisma.user.findFirst({
      where: {
        id: params.userId,
        brandMemberships: { some: { brandId: params.brandId } },
      },
      select: { id: true },
    });
    if (!existing) return null;

    const payload = await this.applySuperAdminFlag(params.brandId, params.input);
    const shouldSyncLocalRole = this.shouldSyncLocalStaff(payload);

    let updated: User;
    try {
      updated = await this.prisma.user.update({
        where: { id: existing.id },
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
      return null;
    }

    if (shouldSyncLocalRole) {
      await this.syncLocalStaffRole(params.localId, updated);
    }

    return this.mapUserAccessRecord({
      brandId: params.brandId,
      localId: params.localId,
      user: updated,
    });
  }

  async setBrandBlockStatus(params: {
    brandId: string;
    localId: string;
    userId: string;
    isBlocked: boolean;
  }): Promise<IdentityUserAccessRecord | null> {
    const membership = await this.prisma.brandUser.findUnique({
      where: {
        brandId_userId: {
          brandId: params.brandId,
          userId: params.userId,
        },
      },
    });
    if (!membership) return null;

    await this.prisma.brandUser.update({
      where: {
        brandId_userId: {
          brandId: params.brandId,
          userId: params.userId,
        },
      },
      data: {
        isBlocked: params.isBlocked,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) return null;

    return this.mapUserAccessRecord({
      brandId: params.brandId,
      localId: params.localId,
      user,
    });
  }

  async remove(params: {
    brandId: string;
    localId: string;
    userId: string;
  }): Promise<RemoveIdentityUserResult | null> {
    const membership = await this.prisma.brandUser.findUnique({
      where: {
        brandId_userId: {
          brandId: params.brandId,
          userId: params.userId,
        },
      },
      select: { brandId: true, userId: true },
    });
    if (!membership) return null;

    const existing = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!existing) return null;

    const locations = await this.prisma.location.findMany({
      where: { brandId: params.brandId },
      select: { id: true },
    });
    const locationIds = locations.map((location) => location.id);
    const scopedLocationIds = locationIds.length > 0 ? locationIds : [params.localId];
    let removeGlobally = false;

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.deleteMany({
        where: {
          userId: params.userId,
          localId: { in: scopedLocationIds },
        },
      });

      await tx.locationStaff.deleteMany({
        where: {
          userId: params.userId,
          localId: { in: scopedLocationIds },
        },
      });

      await tx.brandUser.delete({
        where: {
          brandId_userId: {
            brandId: params.brandId,
            userId: params.userId,
          },
        },
      });

      // tenant-scope-ignore: global membership count is required to decide if user can be deleted globally.
      const remainingMemberships = await tx.brandUser.count({
        where: { userId: params.userId },
      });
      if (remainingMemberships === 0) {
        removeGlobally = true;
        await tx.user.delete({ where: { id: params.userId } });
      }
    });

    return {
      removedGlobally: removeGlobally,
      firebaseUid: existing.firebaseUid,
    };
  }

  private normalizeEmail(email?: string | null): string {
    return (email || '').trim().toLowerCase();
  }

  private async applySuperAdminFlag<T extends Partial<CreateIdentityUserInput | UpdateIdentityUserInput>>(
    brandId: string,
    data: T,
  ): Promise<T> {
    const email = this.normalizeEmail(data.email);
    if (!email) return data;

    const brandConfig = await this.tenantConfig.getBrandConfig(brandId);
    const brandSuperAdminEmail = this.normalizeEmail(brandConfig.superAdminEmail) || SUPER_ADMIN_EMAIL;
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

  private mapPrefs(
    data: Partial<CreateIdentityUserInput | UpdateIdentityUserInput>,
    useDefaults: boolean,
  ) {
    return {
      notificationEmail: data.notificationEmail ?? (useDefaults ? true : undefined),
      notificationWhatsapp: data.notificationWhatsapp ?? (useDefaults ? true : undefined),
      notificationSms: data.notificationSms ?? (useDefaults ? true : undefined),
      prefersBarberSelection: data.prefersBarberSelection ?? (useDefaults ? true : undefined),
    };
  }

  private shouldSyncLocalStaff(data: Partial<CreateIdentityUserInput | UpdateIdentityUserInput>) {
    return (
      data.role !== undefined ||
      data.adminRoleId !== undefined ||
      data.isSuperAdmin !== undefined ||
      data.isPlatformAdmin !== undefined
    );
  }

  private async ensureBrandMembership(brandId: string, userId: string): Promise<void> {
    const brandExists = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!brandExists) return;

    await this.prisma.brandUser.upsert({
      where: {
        brandId_userId: { brandId, userId },
      },
      update: {},
      create: { brandId, userId },
    });
  }

  private async syncLocalStaffRole(
    localId: string,
    user: Pick<User, 'id' | 'role' | 'isSuperAdmin' | 'isPlatformAdmin' | 'adminRoleId'>,
  ): Promise<void> {
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

  private async getBrandSuperAdminEmail(brandId: string): Promise<string> {
    const brandConfig = await this.tenantConfig.getBrandConfig(brandId);
    return this.normalizeEmail(brandConfig.superAdminEmail) || SUPER_ADMIN_EMAIL;
  }

  private async mapUserAccessRecord(params: {
    brandId: string;
    localId: string;
    user: User;
  }): Promise<IdentityUserAccessRecord> {
    const [brandMembership, localStaff, brandSuperAdminEmail] = await Promise.all([
      this.prisma.brandUser.findUnique({
        where: {
          brandId_userId: {
            brandId: params.brandId,
            userId: params.user.id,
          },
        },
        select: { isBlocked: true },
      }),
      this.prisma.locationStaff.findUnique({
        where: {
          localId_userId: {
            localId: params.localId,
            userId: params.user.id,
          },
        },
        select: { adminRoleId: true },
      }),
      this.getBrandSuperAdminEmail(params.brandId),
    ]);

    const email = params.user.email?.toLowerCase() || '';
    const isPlatformAdminByEmail = PLATFORM_ADMIN_EMAILS.includes(email);
    const localAdminRoleId = localStaff?.adminRoleId ?? null;

    return {
      id: params.user.id,
      firebaseUid: params.user.firebaseUid,
      name: params.user.name,
      email: params.user.email,
      phone: params.user.phone,
      role: params.user.role as IdentityUserRole,
      avatar: params.user.avatar,
      adminRoleId: params.user.adminRoleId,
      isSuperAdmin: params.user.isSuperAdmin || email === brandSuperAdminEmail,
      isPlatformAdmin: params.user.isPlatformAdmin || isPlatformAdminByEmail,
      notificationEmail: params.user.notificationEmail,
      notificationWhatsapp: params.user.notificationWhatsapp,
      notificationSms: params.user.notificationSms,
      prefersBarberSelection: params.user.prefersBarberSelection,
      isBlocked: brandMembership?.isBlocked ?? false,
      isLocalAdmin: Boolean(localStaff),
      localAdminRoleId,
    };
  }
}
