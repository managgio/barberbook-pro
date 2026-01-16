import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { AssignBrandAdminDto } from './dto/assign-brand-admin.dto';
import { RemoveBrandAdminDto } from './dto/remove-brand-admin.dto';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageMetrics: UsageMetricsService,
  ) {}

  async listBrands() {
    return this.prisma.brand.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        locations: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, slug: true, isActive: true },
        },
        config: { select: { data: true } },
      },
    });
  }

  async getBrand(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        locations: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, slug: true, isActive: true },
        },
        config: { select: { data: true } },
      },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async createBrand(data: {
    name: string;
    subdomain: string;
    customDomain?: string | null;
    isActive?: boolean;
  }) {
    return this.prisma.brand.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        customDomain: data.customDomain ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateBrand(id: string, data: {
    name?: string;
    subdomain?: string;
    customDomain?: string | null;
    isActive?: boolean;
    defaultLocationId?: string | null;
  }) {
    try {
      return await this.prisma.brand.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new NotFoundException('Brand not found');
    }
  }

  async deleteBrand(id: string) {
    await this.prisma.brand.delete({ where: { id } });
    return { success: true };
  }

  async listLocations(brandId: string) {
    return this.prisma.location.findMany({
      where: { brandId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createLocation(brandId: string, data: { name: string; slug?: string | null; isActive?: boolean }) {
    return this.prisma.location.create({
      data: {
        brandId,
        name: data.name,
        slug: data.slug ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateLocation(id: string, data: { name?: string; slug?: string | null; isActive?: boolean }) {
    try {
      return await this.prisma.location.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new NotFoundException('Location not found');
    }
  }

  async deleteLocation(id: string) {
    await this.prisma.location.delete({ where: { id } });
    return { success: true };
  }

  async getBrandConfig(brandId: string) {
    const config = await this.prisma.brandConfig.findUnique({
      where: { brandId },
      select: { data: true },
    });
    return config?.data || {};
  }

  async listBrandAdmins(brandId: string) {
    const locations = await this.prisma.location.findMany({
      where: { brandId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    const locationIds = locations.map((location) => location.id);
    if (locationIds.length === 0) {
      return { locations: [] };
    }

    const [staffEntries, roles] = await Promise.all([
      this.prisma.locationStaff.findMany({
        where: { localId: { in: locationIds } },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isSuperAdmin: true,
              isPlatformAdmin: true,
            },
          },
          adminRole: { select: { id: true, name: true } },
        },
      }),
      this.prisma.adminRole.findMany({
        where: { localId: { in: locationIds } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, localId: true },
      }),
    ]);

    const staffByLocal = new Map<string, typeof staffEntries>();
    for (const entry of staffEntries) {
      const bucket = staffByLocal.get(entry.localId) || [];
      bucket.push(entry);
      staffByLocal.set(entry.localId, bucket);
    }

    const rolesByLocal = new Map<string, { id: string; name: string }[]>();
    for (const role of roles) {
      const bucket = rolesByLocal.get(role.localId) || [];
      bucket.push({ id: role.id, name: role.name });
      rolesByLocal.set(role.localId, bucket);
    }

    return {
      locations: locations.map((location) => ({
        ...location,
        roles: rolesByLocal.get(location.id) || [],
        admins: (staffByLocal.get(location.id) || []).map((entry) => ({
          userId: entry.user.id,
          name: entry.user.name,
          email: entry.user.email,
          isSuperAdmin: entry.user.isSuperAdmin,
          isPlatformAdmin: entry.user.isPlatformAdmin,
          adminRoleId: entry.adminRoleId ?? null,
          adminRoleName: entry.adminRole?.name || null,
        })),
      })),
    };
  }

  async assignBrandAdmin(brandId: string, data: AssignBrandAdminDto) {
    const applyToAll = data.applyToAll === true;
    if (!applyToAll && !data.localId) {
      throw new BadRequestException('Selecciona un local o activa la asignación global.');
    }
    if (applyToAll && data.adminRoleId) {
      throw new BadRequestException('El rol solo se puede asignar a un local concreto.');
    }

    const email = data.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const locations = applyToAll
      ? await this.prisma.location.findMany({
          where: { brandId },
          select: { id: true },
        })
      : await this.prisma.location.findMany({
          where: { id: data.localId, brandId },
          select: { id: true },
        });

    if (locations.length === 0) {
      throw new NotFoundException('Local no encontrado para la marca.');
    }

    if (!applyToAll && data.adminRoleId) {
      const role = await this.prisma.adminRole.findFirst({
        where: { id: data.adminRoleId, localId: locations[0].id },
      });
      if (!role) {
        throw new BadRequestException('El rol seleccionado no pertenece al local.');
      }
    }

    const operations = [
      this.prisma.brandUser.upsert({
        where: { brandId_userId: { brandId, userId: user.id } },
        update: {},
        create: { brandId, userId: user.id },
      }),
      ...(user.role !== 'admin'
        ? [
            this.prisma.user.update({
              where: { id: user.id },
              data: { role: 'admin' },
            }),
          ]
        : []),
      ...locations.map((location) =>
        this.prisma.locationStaff.upsert({
          where: {
            localId_userId: {
              localId: location.id,
              userId: user.id,
            },
          },
          update: { adminRoleId: applyToAll ? null : data.adminRoleId ?? null },
          create: {
            localId: location.id,
            userId: user.id,
            adminRoleId: applyToAll ? null : data.adminRoleId ?? null,
          },
        }),
      ),
    ];

    await this.prisma.$transaction(operations);
    return { success: true };
  }

  async removeBrandAdmin(brandId: string, data: RemoveBrandAdminDto) {
    const removeFromAll = data.removeFromAll === true;
    if (!removeFromAll && !data.localId) {
      throw new BadRequestException('Selecciona un local o marca la eliminación global.');
    }

    const email = data.email?.toLowerCase();
    const user = data.userId
      ? await this.prisma.user.findUnique({ where: { id: data.userId } })
      : email
        ? await this.prisma.user.findUnique({ where: { email } })
        : null;

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const locations = removeFromAll
      ? await this.prisma.location.findMany({
          where: { brandId },
          select: { id: true },
        })
      : await this.prisma.location.findMany({
          where: { id: data.localId, brandId },
          select: { id: true },
        });

    if (locations.length === 0) {
      throw new NotFoundException('Local no encontrado para la marca.');
    }

    await this.prisma.locationStaff.deleteMany({
      where: {
        userId: user.id,
        localId: { in: locations.map((location) => location.id) },
      },
    });

    return { success: true };
  }

  async updateBrandConfig(brandId: string, data: Record<string, unknown>) {
    const payload = data as Prisma.InputJsonValue;
    return this.prisma.brandConfig.upsert({
      where: { brandId },
      update: { data: payload },
      create: { brandId, data: payload },
    });
  }

  async getLocationConfig(localId: string) {
    const config = await this.prisma.locationConfig.findUnique({
      where: { localId },
      select: { data: true },
    });
    return config?.data || {};
  }

  async updateLocationConfig(localId: string, data: Record<string, unknown>) {
    const payload = data as Prisma.InputJsonValue;
    return this.prisma.locationConfig.upsert({
      where: { localId },
      update: { data: payload },
      create: { localId, data: payload },
    });
  }

  async getUsageMetrics(windowDays: number) {
    return this.usageMetrics.getPlatformMetrics(windowDays);
  }

  async refreshUsageMetrics(windowDays: number) {
    await this.usageMetrics.refreshImageKitUsage();
    return this.usageMetrics.getPlatformMetrics(windowDays, { forceOpenAi: true });
  }
}
