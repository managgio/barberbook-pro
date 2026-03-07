import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TenantConfigService } from '../../../../tenancy/tenant-config.service';
import { PLATFORM_ADMIN_EMAILS } from '../../../../tenancy/tenant.constants';
import {
  FindUsersPageParams,
  UserReadPort,
} from '../../ports/outbound/user-read.port';
import {
  IdentityUserAccessRecord,
  IdentityUserRole,
} from '../../domain/entities/user-access.entity';

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'c.lopemonre@gmail.com').toLowerCase();

type UserWithAccessRelations = User & {
  brandMemberships: Array<{ isBlocked: boolean }>;
  localStaffRoles: Array<{ adminRoleId: string | null }>;
};

@Injectable()
export class PrismaUserReadAdapter implements UserReadPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async findUsersByIds(params: {
    brandId: string;
    localId: string;
    ids: string[];
  }): Promise<IdentityUserAccessRecord[]> {
    const brandSuperAdminEmail = await this.getBrandSuperAdminEmail(params.brandId);
    const users = await this.prisma.user.findMany({
      where: this.buildUsersWhere({
        brandId: params.brandId,
        ids: params.ids,
      }),
      include: this.buildUserAccessInclude(params.brandId, params.localId),
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.toIdentityUserAccessRecord(user as UserWithAccessRelations, brandSuperAdminEmail));
  }

  async findUsersPage(params: FindUsersPageParams): Promise<{ total: number; users: IdentityUserAccessRecord[] }> {
    const brandSuperAdminEmail = await this.getBrandSuperAdminEmail(params.brandId);
    const where = this.buildUsersWhere({
      brandId: params.brandId,
      role: params.role,
      query: params.query,
    });

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: this.buildUserAccessInclude(params.brandId, params.localId),
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      total,
      users: users.map((user) => this.toIdentityUserAccessRecord(user as UserWithAccessRelations, brandSuperAdminEmail)),
    };
  }

  async findUserById(params: {
    brandId: string;
    localId: string;
    userId: string;
  }): Promise<IdentityUserAccessRecord | null> {
    const brandSuperAdminEmail = await this.getBrandSuperAdminEmail(params.brandId);
    const user = await this.prisma.user.findFirst({
      where: {
        id: params.userId,
        brandMemberships: { some: { brandId: params.brandId } },
      },
      include: this.buildUserAccessInclude(params.brandId, params.localId),
    });

    if (!user) return null;
    return this.toIdentityUserAccessRecord(user as UserWithAccessRelations, brandSuperAdminEmail);
  }

  async findUserByEmail(params: {
    brandId: string;
    localId: string;
    email: string;
  }): Promise<IdentityUserAccessRecord | null> {
    const brandSuperAdminEmail = await this.getBrandSuperAdminEmail(params.brandId);
    const user = await this.prisma.user.findFirst({
      where: {
        email: params.email.toLowerCase(),
        brandMemberships: { some: { brandId: params.brandId } },
      },
      include: this.buildUserAccessInclude(params.brandId, params.localId),
    });

    if (!user) return null;
    return this.toIdentityUserAccessRecord(user as UserWithAccessRelations, brandSuperAdminEmail);
  }

  async findUserByFirebaseUid(params: {
    brandId: string;
    localId: string;
    firebaseUid: string;
  }): Promise<IdentityUserAccessRecord | null> {
    const brandSuperAdminEmail = await this.getBrandSuperAdminEmail(params.brandId);
    const user = await this.prisma.user.findFirst({
      where: {
        firebaseUid: params.firebaseUid,
        brandMemberships: { some: { brandId: params.brandId } },
      },
      include: this.buildUserAccessInclude(params.brandId, params.localId),
    });

    if (!user) return null;
    return this.toIdentityUserAccessRecord(user as UserWithAccessRelations, brandSuperAdminEmail);
  }

  private normalizeEmail(email?: string | null): string {
    return (email || '').trim().toLowerCase();
  }

  private async getBrandSuperAdminEmail(brandId: string): Promise<string> {
    const brandConfig = await this.tenantConfig.getBrandConfig(brandId);
    return this.normalizeEmail(brandConfig.superAdminEmail) || SUPER_ADMIN_EMAIL;
  }

  private buildUsersWhere(options: {
    brandId: string;
    ids?: string[];
    role?: IdentityUserRole;
    query?: string;
  }): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { brandMemberships: { some: { brandId: options.brandId } } };

    if (options.ids && options.ids.length > 0) {
      where.id = { in: options.ids };
    }

    if (options.role) {
      where.role = options.role;
    }

    const query = options.query?.trim();
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { email: { contains: query } },
        { phone: { contains: query } },
      ];
    }

    return where;
  }

  private buildUserAccessInclude(brandId: string, localId: string) {
    return {
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
    } as const;
  }

  private toIdentityUserAccessRecord(
    user: UserWithAccessRelations,
    brandSuperAdminEmail: string,
  ): IdentityUserAccessRecord {
    const email = user.email?.toLowerCase() || '';
    const localAdminRoleId = user.localStaffRoles[0]?.adminRoleId ?? null;
    const isPlatformAdminByEmail = PLATFORM_ADMIN_EMAILS.includes(email);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as IdentityUserRole,
      avatar: user.avatar,
      adminRoleId: user.adminRoleId,
      isSuperAdmin: user.isSuperAdmin || email === brandSuperAdminEmail,
      isPlatformAdmin: user.isPlatformAdmin || isPlatformAdminByEmail,
      notificationEmail: user.notificationEmail,
      notificationWhatsapp: user.notificationWhatsapp,
      notificationSms: user.notificationSms,
      prefersBarberSelection: user.prefersBarberSelection,
      isBlocked: user.brandMemberships[0]?.isBlocked ?? false,
      isLocalAdmin: user.localStaffRoles.length > 0,
      localAdminRoleId,
    };
  }
}
