import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageKitService } from '../imagekit/imagekit.service';
import { UsageMetricsService } from '../usage-metrics/usage-metrics.service';
import { AssignBrandAdminDto } from './dto/assign-brand-admin.dto';
import { RemoveBrandAdminDto } from './dto/remove-brand-admin.dto';

const mergeRecords = <T extends Record<string, any>>(base: T, override?: Partial<T>): T => {
  if (!override) return { ...base };
  const result = { ...base } as Record<string, any>;
  Object.entries(override).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeRecords((base as any)?.[key] || {}, value as Record<string, any>);
    } else if (value !== undefined) {
      result[key] = value;
    }
  });
  return result as T;
};

const sanitizeThemeConfig = (data: Record<string, unknown>) => {
  if (!data || typeof data !== 'object') return data;
  const theme = data.theme;
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return data;
  const rawPrimary = typeof (theme as any).primary === 'string' ? (theme as any).primary.trim() : '';
  const rawMode = typeof (theme as any).mode === 'string' ? (theme as any).mode.trim().toLowerCase() : '';
  const mode = rawMode === 'light' || rawMode === 'dark' ? rawMode : '';
  if (rawPrimary || mode) {
    const normalizedTheme = {
      ...(theme as Record<string, unknown>),
      ...(rawPrimary ? { primary: rawPrimary } : {}),
      ...(mode ? { mode } : {}),
    };
    return { ...data, theme: normalizedTheme };
  }
  const next = { ...data } as Record<string, unknown>;
  const nextTheme = { ...(theme as Record<string, unknown>) };
  delete (nextTheme as any).primary;
  delete (nextTheme as any).mode;
  if (Object.keys(nextTheme).length === 0) {
    delete (next as any).theme;
  } else {
    (next as any).theme = nextTheme;
  }
  return next;
};

const BRANDING_FILE_ID_FIELDS = [
  'logoFileId',
  'logoLightFileId',
  'logoDarkFileId',
  'heroBackgroundFileId',
  'heroImageFileId',
  'signImageFileId',
] as const;

type HealthStatus = 'ok' | 'warning' | 'error' | 'disabled';
type IntegrationKey = 'email' | 'twilio' | 'stripe' | 'imagekit' | 'ai';

type IntegrationHealth = {
  key: IntegrationKey;
  status: HealthStatus;
  summary: string;
  details: string[];
};

type LocationHealth = {
  id: string;
  name: string;
  slug: string | null;
  isActive: boolean;
  overallStatus: HealthStatus;
  integrations: IntegrationHealth[];
};

const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  error: 4,
  warning: 3,
  ok: 2,
  disabled: 1,
};

const pickWorstStatus = (statuses: HealthStatus[]): HealthStatus =>
  statuses.reduce((worst, current) =>
    HEALTH_PRIORITY[current] > HEALTH_PRIORITY[worst] ? current : worst, 'disabled');

const resolveCountsByStatus = (statuses: HealthStatus[]) =>
  statuses.reduce<Record<HealthStatus, number>>(
    (acc, status) => ({ ...acc, [status]: acc[status] + 1 }),
    { ok: 0, warning: 0, error: 0, disabled: 0 },
  );

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageKit: ImageKitService,
    private readonly usageMetrics: UsageMetricsService,
  ) {}

  private readonly logger = new Logger(PlatformAdminService.name);

  private getEmailHealth(config: Record<string, any>, notifications: Record<string, any>): IntegrationHealth {
    const enabled = notifications?.email !== false;
    if (!enabled) {
      return { key: 'email', status: 'disabled', summary: 'Email desactivado', details: [] };
    }
    const email = config?.email || {};
    const missing: string[] = [];
    if (!email.user) missing.push('user');
    if (!email.password) missing.push('password');
    const details: string[] = [];
    if (!email.host) details.push('host ausente (usa fallback global)');
    if (!email.port) details.push('port ausente (usa fallback global)');
    if (missing.length > 0) {
      return {
        key: 'email',
        status: 'error',
        summary: 'SMTP incompleto',
        details: [`Faltan credenciales: ${missing.join(', ')}`],
      };
    }
    return {
      key: 'email',
      status: details.length > 0 ? 'warning' : 'ok',
      summary: 'SMTP configurado',
      details,
    };
  }

  private getTwilioHealth(config: Record<string, any>, notifications: Record<string, any>): IntegrationHealth {
    const smsEnabled = notifications?.sms !== false;
    const whatsappEnabled = notifications?.whatsapp !== false;
    if (!smsEnabled && !whatsappEnabled) {
      return { key: 'twilio', status: 'disabled', summary: 'SMS/WhatsApp desactivados', details: [] };
    }
    const twilio = config?.twilio || {};
    const missing: string[] = [];
    if (!twilio.accountSid) missing.push('accountSid');
    if (!twilio.authToken) missing.push('authToken');
    if (missing.length > 0) {
      return {
        key: 'twilio',
        status: 'error',
        summary: 'Twilio incompleto',
        details: [`Faltan credenciales: ${missing.join(', ')}`],
      };
    }
    const details: string[] = [];
    if (smsEnabled && !twilio.messagingServiceSid && !twilio.smsSenderId) {
      details.push('SMS sin sender explícito (messagingServiceSid/smsSenderId)');
    }
    if (whatsappEnabled && !twilio.whatsappFrom) {
      details.push('WhatsApp sin remitente (whatsappFrom)');
    }
    return {
      key: 'twilio',
      status: details.some((detail) => detail.includes('sin remitente')) ? 'error' : details.length > 0 ? 'warning' : 'ok',
      summary: 'Twilio configurado',
      details,
    };
  }

  private getStripeHealth(
    brandConfig: Record<string, any>,
    locationConfig: Record<string, any>,
  ): IntegrationHealth {
    const brandStripe = brandConfig?.payments?.stripe || {};
    const locationStripe = locationConfig?.payments?.stripe || {};
    const mode = brandStripe?.mode === 'brand' ? 'brand' : 'location';
    const statusDetails: string[] = [];

    if (mode === 'brand') {
      if (brandStripe.enabled !== true) {
        return { key: 'stripe', status: 'disabled', summary: 'Stripe desactivado (modo marca)', details: [] };
      }
      if (!brandStripe.accountId) {
        return { key: 'stripe', status: 'error', summary: 'Stripe marca sin accountId', details: [] };
      }
      if (brandStripe.detailsSubmitted === false) statusDetails.push('detailsSubmitted=false');
      if (brandStripe.chargesEnabled === false) statusDetails.push('chargesEnabled=false');
      if (brandStripe.payoutsEnabled === false) statusDetails.push('payoutsEnabled=false');
      return {
        key: 'stripe',
        status: statusDetails.length > 0 ? 'warning' : 'ok',
        summary: 'Stripe modo marca',
        details: statusDetails,
      };
    }

    if (locationStripe.platformEnabled === false || locationStripe.enabled !== true) {
      return { key: 'stripe', status: 'disabled', summary: 'Stripe local desactivado', details: [] };
    }
    if (!locationStripe.accountId) {
      return { key: 'stripe', status: 'error', summary: 'Stripe local sin accountId', details: [] };
    }
    if (locationStripe.detailsSubmitted === false) statusDetails.push('detailsSubmitted=false');
    if (locationStripe.chargesEnabled === false) statusDetails.push('chargesEnabled=false');
    if (locationStripe.payoutsEnabled === false) statusDetails.push('payoutsEnabled=false');
    return {
      key: 'stripe',
      status: statusDetails.length > 0 ? 'warning' : 'ok',
      summary: 'Stripe modo local',
      details: statusDetails,
    };
  }

  private getImageKitHealth(config: Record<string, any>): IntegrationHealth {
    const imagekit = config?.imagekit || {};
    const missing: string[] = [];
    if (!imagekit.publicKey) missing.push('publicKey');
    if (!imagekit.privateKey) missing.push('privateKey');
    if (!imagekit.urlEndpoint) missing.push('urlEndpoint');
    if (missing.length > 0) {
      return {
        key: 'imagekit',
        status: 'error',
        summary: 'ImageKit incompleto',
        details: [`Faltan campos: ${missing.join(', ')}`],
      };
    }
    const details: string[] = [];
    if (!imagekit.folder) {
      details.push('folder no definido (usa fallback)');
    }
    return {
      key: 'imagekit',
      status: details.length > 0 ? 'warning' : 'ok',
      summary: 'ImageKit configurado',
      details,
    };
  }

  private getAiHealth(config: Record<string, any>): IntegrationHealth {
    const ai = config?.ai || {};
    const provider = typeof ai.provider === 'string' ? ai.provider.trim().toLowerCase() : '';
    if (!provider || provider === 'disabled' || provider === 'none') {
      return { key: 'ai', status: 'disabled', summary: 'IA desactivada', details: [] };
    }
    if (!ai.apiKey) {
      return { key: 'ai', status: 'error', summary: 'IA sin API key', details: [] };
    }
    const details: string[] = [];
    if (!ai.model) {
      details.push('model no definido (usa fallback)');
    }
    return {
      key: 'ai',
      status: details.length > 0 ? 'warning' : 'ok',
      summary: `IA (${provider}) configurada`,
      details,
    };
  }

  private collectBrandingFileIds(target: Set<string>, branding?: Record<string, unknown> | null) {
    if (!branding || typeof branding !== 'object') return;
    for (const field of BRANDING_FILE_ID_FIELDS) {
      const value = (branding as Record<string, unknown>)[field];
      if (typeof value === 'string') {
        const normalized = value.trim();
        if (normalized) target.add(normalized);
      }
    }
  }

  private async deleteImageKitFiles(brandId: string, fileIds: Set<string>) {
    if (fileIds.size === 0) return;
    try {
      const result = await this.imageKit.deleteFilesForBrand(Array.from(fileIds), brandId, {
        continueOnError: true,
      });
      if (result.failures.length > 0) {
        for (const failure of result.failures) {
          this.logger.warn(
            `No se pudo eliminar el archivo ${failure.fileId} en ImageKit (brand ${brandId}): ${failure.error}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo limpiar ImageKit para la marca ${brandId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

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
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException('Brand not found');

    const locations = await this.prisma.location.findMany({
      where: { brandId: id },
      select: { id: true },
    });
    const locationIds = locations.map((location) => location.id);

    const [brandConfig, locationConfigs, barbers, products] = await Promise.all([
      this.prisma.brandConfig.findUnique({ where: { brandId: id }, select: { data: true } }),
      this.prisma.locationConfig.findMany({
        where: { localId: { in: locationIds } },
        select: { data: true },
      }),
      this.prisma.barber.findMany({
        where: { localId: { in: locationIds } },
        select: { photoFileId: true },
      }),
      this.prisma.product.findMany({
        where: { localId: { in: locationIds } },
        select: { imageFileId: true },
      }),
    ]);

    const fileIds = new Set<string>();
    const brandData = (brandConfig?.data || {}) as Record<string, unknown>;
    this.collectBrandingFileIds(fileIds, brandData.branding as Record<string, unknown>);
    for (const config of locationConfigs) {
      const locationData = (config.data || {}) as Record<string, unknown>;
      this.collectBrandingFileIds(fileIds, locationData.branding as Record<string, unknown>);
    }
    for (const barber of barbers) {
      if (barber.photoFileId) fileIds.add(barber.photoFileId);
    }
    for (const product of products) {
      if (product.imageFileId) fileIds.add(product.imageFileId);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.brand.update({
          where: { id },
          data: { defaultLocationId: null },
        });

        await tx.auditLog.deleteMany({ where: { brandId: id } });
        await tx.consentRecord.deleteMany({ where: { brandId: id } });
        await tx.providerUsageDaily.deleteMany({ where: { brandId: id } });
        await tx.webVitalEvent.deleteMany({ where: { brandId: id } });
        await tx.apiMetricEvent.deleteMany({ where: { brandId: id } });
        await tx.brandUser.deleteMany({ where: { brandId: id } });
        await tx.referralConfigTemplate.deleteMany({ where: { brandId: id } });
        await tx.brandLegalSettings.deleteMany({ where: { brandId: id } });
        await tx.brandConfig.deleteMany({ where: { brandId: id } });

        if (locationIds.length > 0) {
          await tx.reviewRequest.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.rewardTransaction.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.referralAttribution.updateMany({
            where: { localId: { in: locationIds }, firstAppointmentId: { not: null } },
            data: { firstAppointmentId: null },
          });
          await tx.appointment.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.referralAttribution.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.referralCode.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.rewardWallet.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.coupon.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.cashMovement.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.referralProgramConfig.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.reviewProgramConfig.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.offer.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.loyaltyProgram.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.barberHoliday.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.barberSchedule.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.clientNote.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.alert.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.generalHoliday.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.aiChatSession.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.aiBusinessFact.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.locationStaff.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.user.updateMany({
            where: { adminRole: { localId: { in: locationIds } } },
            data: { adminRoleId: null },
          });
          await tx.adminRole.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.locationConfig.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.shopSchedule.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.siteSettings.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.product.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.service.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.productCategory.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.serviceCategory.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.barber.deleteMany({ where: { localId: { in: locationIds } } });
          await tx.location.deleteMany({ where: { id: { in: locationIds } } });
        }

        await tx.brand.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          `No se pudo eliminar la marca porque quedan datos relacionados (${String(
            error.meta?.field_name ?? 'FK',
          )}).`,
        );
      }
      throw error;
    }

    await this.deleteImageKitFiles(id, fileIds);
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
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const fallbackName = email.split('@')[0]?.trim() || 'Admin pendiente';
      user = await this.prisma.user.create({
        data: {
          name: fallbackName,
          email,
          role: 'admin',
        },
      });
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
    const payload = sanitizeThemeConfig(data) as Prisma.InputJsonValue;
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
    const payload = sanitizeThemeConfig(data) as Prisma.InputJsonValue;
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

  async getBrandHealth(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        customDomain: true,
        isActive: true,
      },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const [brandConfig, locations, locationConfigs] = await Promise.all([
      this.prisma.brandConfig.findUnique({
        where: { brandId },
        select: { data: true },
      }),
      this.prisma.location.findMany({
        where: { brandId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, slug: true, isActive: true },
      }),
      this.prisma.locationConfig.findMany({
        where: { local: { brandId } },
        select: { localId: true, data: true },
      }),
    ]);

    const brandData = ((brandConfig?.data || {}) as Record<string, any>) || {};
    const locationConfigByLocalId = new Map(
      locationConfigs.map((config) => [config.localId, ((config.data || {}) as Record<string, any>) || {}]),
    );

    const locationsHealth: LocationHealth[] = locations.map((location) => {
      const localData = locationConfigByLocalId.get(location.id) || {};
      const effectiveConfig = mergeRecords(brandData, localData);
      const notifications = mergeRecords(brandData.notificationPrefs || {}, localData.notificationPrefs || {});
      const integrations: IntegrationHealth[] = [
        this.getEmailHealth(effectiveConfig, notifications),
        this.getTwilioHealth(effectiveConfig, notifications),
        this.getStripeHealth(brandData, localData),
        this.getImageKitHealth(effectiveConfig),
        this.getAiHealth(effectiveConfig),
      ];
      const overallStatus = pickWorstStatus(integrations.map((item) => item.status));
      return {
        ...location,
        overallStatus,
        integrations,
      };
    });

    const overallStatuses = locationsHealth.map((item) => item.overallStatus);
    const integrationsByStatus = resolveCountsByStatus(
      locationsHealth.flatMap((location) => location.integrations.map((integration) => integration.status)),
    );

    return {
      brand,
      checkedAt: new Date().toISOString(),
      summary: {
        locations: locationsHealth.length,
        overallStatus: pickWorstStatus(overallStatuses.length ? overallStatuses : ['disabled']),
        byStatus: resolveCountsByStatus(overallStatuses),
        integrationsByStatus,
      },
      locations: locationsHealth,
    };
  }
}
