import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, OfferTarget, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { mapAppointment } from './appointments.mapper';
import { isDateInRange, minutesToTime, normalizeRange, normalizeSchedule, timeToMinutes } from '../schedules/schedule.utils';
import { HolidaysService } from '../holidays/holidays.service';
import { SchedulesService } from '../schedules/schedules.service';
import { DEFAULT_SHOP_SCHEDULE, ShopSchedule } from '../schedules/schedule.types';
import { NotificationsService } from '../notifications/notifications.service';
import { computeServicePricing, isOfferActiveNow } from '../services/services.pricing';
import { LegalService } from '../legal/legal.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SettingsService } from '../settings/settings.service';
import { computeProductPricing } from '../products/products.pricing';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ReferralAttributionService } from '../referrals/referral-attribution.service';
import { RewardsService } from '../referrals/rewards.service';
import { ReviewRequestService } from '../reviews/review-request.service';
import { BarbersService } from '../barbers/barbers.service';
import {
  APP_TIMEZONE,
  endOfDayInTimeZone,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getWeekdayKey,
  makeDateInTimeZone,
  startOfDayInTimeZone,
} from '../../utils/timezone';

const DEFAULT_SERVICE_DURATION = 30;
const SLOT_INTERVAL_MINUTES = 15;
const CONFIRMATION_GRACE_MS = 60 * 1000;
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const ANONYMIZED_NAME = 'Invitado anonimizado';
const DASHBOARD_DEFAULT_WINDOW_DAYS = 30;
const DASHBOARD_MIN_WINDOW_DAYS = 7;
const DASHBOARD_MAX_WINDOW_DAYS = 60;
const DASHBOARD_LOSS_WINDOW_DAYS = 30;
const DASHBOARD_TICKET_WINDOW_DAYS = 14;
const DASHBOARD_OCCUPANCY_START_HOUR = 9;
const DASHBOARD_OCCUPANCY_END_HOUR = 20;
const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const WEEKDAY_INDEX: Record<(typeof WEEKDAY_ORDER)[number], number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const buildAnonymizedContact = (id: string) => `anonimo+${id.slice(0, 8)}@example.invalid`;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { user: true; barber: true; service: true; products: { include: { product: true } } };
}>;
type AppointmentListFilters = {
  userId?: string;
  barberId?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: Prisma.SortOrder;
};

type DashboardSummaryParams = {
  windowDays?: number;
  barberId?: string;
};

type DashboardSummaryTodayAppointment = {
  id: string;
  startDateTime: string;
  serviceName: string;
  barberName: string;
  clientName: string;
};

type AdminSearchClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type AdminCalendarClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type AppointmentSlotRecord = {
  startDateTime: Date;
  service?: { duration?: number | null } | null;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly schedulesService: SchedulesService,
    private readonly notificationsService: NotificationsService,
    private readonly legalService: LegalService,
    private readonly auditLogs: AuditLogsService,
    private readonly settingsService: SettingsService,
    private readonly loyaltyService: LoyaltyService,
    private readonly referralAttributionService: ReferralAttributionService,
    private readonly rewardsService: RewardsService,
    private readonly reviewRequestService: ReviewRequestService,
    private readonly barbersService: BarbersService,
  ) {}

  private async getServiceDuration(serviceId?: string) {
    if (!serviceId) return DEFAULT_SERVICE_DURATION;
    const localId = getCurrentLocalId();
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId },
    });
    return service?.duration ?? DEFAULT_SERVICE_DURATION;
  }

  private isTransactionConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private async assertNoOverlappingAppointment(
    tx: Prisma.TransactionClient,
    params: {
      barberId: string;
      startDateTime: Date;
      duration: number;
      bufferMinutes: number;
      appointmentIdToIgnore?: string;
    },
  ) {
    const localId = getCurrentLocalId();
    const dateOnly = formatDateInTimeZone(params.startDateTime, APP_TIMEZONE);
    const appointments = await tx.appointment.findMany({
      where: {
        localId,
        barberId: params.barberId,
        status: { not: 'cancelled' },
        startDateTime: {
          gte: startOfDayInTimeZone(dateOnly, APP_TIMEZONE),
          lte: endOfDayInTimeZone(dateOnly, APP_TIMEZONE),
        },
        NOT: params.appointmentIdToIgnore ? { id: params.appointmentIdToIgnore } : undefined,
      },
      include: { service: true },
    });

    const buffer = Math.max(0, params.bufferMinutes);
    const newStart = params.startDateTime;
    const newEnd = new Date(newStart.getTime() + (params.duration + buffer) * 60 * 1000);

    const overlaps = appointments.some((appointment) => {
      const existingDuration = appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
      const existingEnd = new Date(
        appointment.startDateTime.getTime() + (existingDuration + buffer) * 60 * 1000,
      );
      return newStart < existingEnd && newEnd > appointment.startDateTime;
    });

    if (overlaps) {
      throw new BadRequestException('Horario no disponible.');
    }
  }

  private async assertSlotAvailable(params: {
    barberId: string;
    serviceId?: string;
    startDateTime: string;
    appointmentIdToIgnore?: string;
  }) {
    const startDate = new Date(params.startDateTime);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Horario no disponible.');
    }
    const dateOnly = formatDateInTimeZone(startDate, APP_TIMEZONE);
    const slotTime = formatTimeInTimeZone(startDate, APP_TIMEZONE);
    const availableSlots = await this.getAvailableSlots(params.barberId, dateOnly, {
      serviceId: params.serviceId,
      appointmentIdToIgnore: params.appointmentIdToIgnore,
    });
    if (!availableSlots.includes(slotTime)) {
      throw new BadRequestException('Horario no disponible.');
    }
  }

  private shouldHoldStock(status: AppointmentStatus) {
    return status !== 'cancelled' && status !== 'no_show';
  }

  private async getProductOffers(referenceDate: Date) {
    const localId = getCurrentLocalId();
    const offers = await this.prisma.offer.findMany({
      where: { active: true, localId, target: OfferTarget.product },
      include: { productCategories: true, products: true },
    });
    return offers.filter((offer) => isOfferActiveNow(offer, referenceDate));
  }

  private async resolveProductSelection(
    items: Array<{ productId: string; quantity: number }>,
    options: { allowInactive: boolean; allowPrivate: boolean; referenceDate: Date; existingPrices?: Map<string, number> },
  ) {
    const normalized = (items || [])
      .map((item) => ({
        productId: item.productId,
        quantity: Math.max(0, Math.floor(item.quantity)),
      }))
      .filter((item) => item.productId && item.quantity > 0);
    if (normalized.length === 0) {
      return { items: [], total: 0 };
    }

    const localId = getCurrentLocalId();
    const productIds = Array.from(new Set(normalized.map((item) => item.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, localId },
      include: { category: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o varios productos no existen en este local.');
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    for (const product of products) {
      if (!options.allowInactive && product.isActive === false) {
        throw new BadRequestException(`El producto "${product.name}" no está disponible.`);
      }
      if (!options.allowPrivate && product.isPublic === false) {
        throw new BadRequestException(`El producto "${product.name}" no está disponible para clientes.`);
      }
    }

    const offers = await this.getProductOffers(options.referenceDate);
    const itemsDetailed = normalized.map((item) => {
      const product = productById.get(item.productId)!;
      const overridePrice = options.existingPrices?.get(product.id);
      const pricing = overridePrice === undefined
        ? computeProductPricing(product, offers, options.referenceDate)
        : null;
      const unitPrice = overridePrice ?? pricing?.finalPrice ?? Number(product.price);
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        product,
      };
    });

    const total = itemsDetailed.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    return { items: itemsDetailed, total };
  }

  private buildListWhere(filters?: AppointmentListFilters): Prisma.AppointmentWhereInput {
    const localId = getCurrentLocalId();
    const where: Prisma.AppointmentWhereInput = { localId };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.barberId) where.barberId = filters.barberId;
    if (filters?.date) {
      where.startDateTime = {
        gte: startOfDayInTimeZone(filters.date, APP_TIMEZONE),
        lte: endOfDayInTimeZone(filters.date, APP_TIMEZONE),
      };
    } else if (filters?.dateFrom || filters?.dateTo) {
      where.startDateTime = {
        ...(filters.dateFrom ? { gte: startOfDayInTimeZone(filters.dateFrom, APP_TIMEZONE) } : {}),
        ...(filters.dateTo ? { lte: endOfDayInTimeZone(filters.dateTo, APP_TIMEZONE) } : {}),
      };
    }
    return where;
  }

  private buildListOrder(filters?: AppointmentListFilters): Prisma.AppointmentOrderByWithRelationInput {
    return { startDateTime: filters?.sort === 'desc' ? 'desc' : 'asc' };
  }

  private shiftDateInTimeZone(dateOnly: string, days: number) {
    const reference = makeDateInTimeZone(dateOnly, { hour: 12, minute: 0 }, APP_TIMEZONE);
    if (Number.isNaN(reference.getTime())) return dateOnly;
    reference.setUTCDate(reference.getUTCDate() + days);
    return formatDateInTimeZone(reference, APP_TIMEZONE);
  }

  private isDateWithinRange(dateOnly: string, startDate: string, endDate: string) {
    return dateOnly >= startDate && dateOnly <= endDate;
  }

  async getDashboardSummary(params?: DashboardSummaryParams) {
    const localId = getCurrentLocalId();
    const windowDays = Math.min(
      DASHBOARD_MAX_WINDOW_DAYS,
      Math.max(
        DASHBOARD_MIN_WINDOW_DAYS,
        Math.floor(params?.windowDays ?? DASHBOARD_DEFAULT_WINDOW_DAYS),
      ),
    );

    const selectedBarberId = params?.barberId?.trim() || null;
    const now = new Date();
    const todayDate = formatDateInTimeZone(now, APP_TIMEZONE);
    const rangeStartDate = this.shiftDateInTimeZone(todayDate, -(windowDays - 1));
    const queryWindowDays = Math.max(
      windowDays,
      DASHBOARD_LOSS_WINDOW_DAYS,
      DASHBOARD_TICKET_WINDOW_DAYS,
    );
    const queryRangeStartDate = this.shiftDateInTimeZone(todayDate, -(queryWindowDays - 1));
    const lossRangeStart = this.shiftDateInTimeZone(todayDate, -(DASHBOARD_LOSS_WINDOW_DAYS - 1));
    const ticketRangeStart = this.shiftDateInTimeZone(todayDate, -(DASHBOARD_TICKET_WINDOW_DAYS - 1));
    const todayWeekdayIndex = WEEKDAY_INDEX[getWeekdayKey(todayDate, APP_TIMEZONE)];
    const weekStartDate = this.shiftDateInTimeZone(todayDate, -(todayWeekdayIndex - 1));
    const weekEndDate = this.shiftDateInTimeZone(weekStartDate, 6);
    const occupancyHours = Array.from(
      { length: DASHBOARD_OCCUPANCY_END_HOUR - DASHBOARD_OCCUPANCY_START_HOUR + 1 },
      (_, index) => DASHBOARD_OCCUPANCY_START_HOUR + index,
    );

    const [barbers, appointments] = await Promise.all([
      this.prisma.barber.findMany({
        where: { localId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          localId,
          ...(selectedBarberId ? { barberId: selectedBarberId } : {}),
          startDateTime: {
            gte: startOfDayInTimeZone(queryRangeStartDate, APP_TIMEZONE),
            lte: endOfDayInTimeZone(todayDate, APP_TIMEZONE),
          },
        },
        orderBy: { startDateTime: 'asc' },
        select: {
          id: true,
          startDateTime: true,
          status: true,
          price: true,
          guestName: true,
          serviceNameSnapshot: true,
          barberNameSnapshot: true,
          user: { select: { name: true } },
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      }),
    ]);

    const todayAppointments: DashboardSummaryTodayAppointment[] = [];
    const revenueByDate = new Map<string, number>();
    const serviceMixByName = new Map<string, number>();
    const ticketByDate = new Map<string, { total: number; count: number }>();
    const lossByWeekday = WEEKDAY_ORDER.map((_, index) => ({
      day: index + 1,
      noShow: 0,
      cancelled: 0,
    }));
    const occupancyMatrix = occupancyHours.map(() => Array.from({ length: 7 }, () => 0));
    let maxOccupancy = 1;
    let todayRevenue = 0;
    let weekCancelled = 0;
    let weekNoShow = 0;

    for (const appointment of appointments) {
      const dateOnly = formatDateInTimeZone(appointment.startDateTime, APP_TIMEZONE);
      const status = appointment.status;
      const isActive =
        status !== AppointmentStatus.cancelled && status !== AppointmentStatus.no_show;
      const isRevenue = status === AppointmentStatus.completed;
      const weekdayIndex = WEEKDAY_INDEX[getWeekdayKey(dateOnly, APP_TIMEZONE)];
      const serviceName =
        appointment.service?.name ||
        appointment.serviceNameSnapshot ||
        'Servicio eliminado';
      const barberName =
        appointment.barber?.name ||
        appointment.barberNameSnapshot ||
        'Profesional eliminado';
      const clientName =
        appointment.guestName?.trim() ||
        appointment.user?.name?.trim() ||
        'Sin nombre';
      const price = Number(appointment.price || 0);

      if (dateOnly === todayDate && isActive) {
        todayAppointments.push({
          id: appointment.id,
          startDateTime: appointment.startDateTime.toISOString(),
          serviceName,
          barberName,
          clientName,
        });
      }

      if (dateOnly === todayDate && isRevenue) {
        todayRevenue += price;
      }

      if (
        this.isDateWithinRange(dateOnly, weekStartDate, weekEndDate) &&
        status === AppointmentStatus.cancelled
      ) {
        weekCancelled += 1;
      }
      if (
        this.isDateWithinRange(dateOnly, weekStartDate, weekEndDate) &&
        status === AppointmentStatus.no_show
      ) {
        weekNoShow += 1;
      }

      if (isRevenue) {
        revenueByDate.set(dateOnly, (revenueByDate.get(dateOnly) || 0) + price);
      }

      if (isRevenue && this.isDateWithinRange(dateOnly, lossRangeStart, todayDate)) {
        serviceMixByName.set(serviceName, (serviceMixByName.get(serviceName) || 0) + 1);
      }

      if (isRevenue && this.isDateWithinRange(dateOnly, ticketRangeStart, todayDate)) {
        const current = ticketByDate.get(dateOnly) || { total: 0, count: 0 };
        current.total += price;
        current.count += 1;
        ticketByDate.set(dateOnly, current);
      }

      if (
        this.isDateWithinRange(dateOnly, lossRangeStart, todayDate) &&
        (status === AppointmentStatus.no_show || status === AppointmentStatus.cancelled)
      ) {
        const entry = lossByWeekday[weekdayIndex - 1];
        if (status === AppointmentStatus.no_show) {
          entry.noShow += 1;
        } else {
          entry.cancelled += 1;
        }
      }

      if (isActive && this.isDateWithinRange(dateOnly, lossRangeStart, todayDate)) {
        const hour = Number(formatTimeInTimeZone(appointment.startDateTime, APP_TIMEZONE).slice(0, 2));
        const hourIndex = occupancyHours.indexOf(hour);
        if (hourIndex !== -1) {
          occupancyMatrix[hourIndex][weekdayIndex - 1] += 1;
          maxOccupancy = Math.max(maxOccupancy, occupancyMatrix[hourIndex][weekdayIndex - 1]);
        }
      }
    }

    const revenueDaily: Array<{ date: string; value: number }> = [];
    for (let offset = 0; offset < windowDays; offset += 1) {
      const date = this.shiftDateInTimeZone(rangeStartDate, offset);
      revenueDaily.push({ date, value: Number((revenueByDate.get(date) || 0).toFixed(2)) });
    }

    const serviceMixEntries = Array.from(serviceMixByName.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const serviceMixTop = serviceMixEntries.slice(0, 5);
    const serviceMixOthers = serviceMixEntries
      .slice(5)
      .reduce((sum, item) => sum + item.value, 0);
    const serviceMix =
      serviceMixOthers > 0
        ? [...serviceMixTop, { name: 'Otros', value: serviceMixOthers }]
        : serviceMixTop;

    const ticketDaily: Array<{ date: string; value: number }> = [];
    let ticketAverageAccumulator = 0;
    for (let offset = 0; offset < DASHBOARD_TICKET_WINDOW_DAYS; offset += 1) {
      const date = this.shiftDateInTimeZone(ticketRangeStart, offset);
      const entry = ticketByDate.get(date);
      const value = entry && entry.count > 0 ? Number((entry.total / entry.count).toFixed(2)) : 0;
      ticketAverageAccumulator += value;
      ticketDaily.push({ date, value });
    }
    const ticketAverage = Number(
      (ticketAverageAccumulator / (ticketDaily.length || 1)).toFixed(2),
    );

    return {
      windowDays,
      generatedAt: now.toISOString(),
      barbers,
      stats: {
        todayAppointments: todayAppointments.length,
        revenueToday: Number(todayRevenue.toFixed(2)),
        weekCancelled,
        weekNoShow,
      },
      todayAppointments,
      revenueDaily,
      serviceMix,
      ticketDaily,
      ticketAverage,
      lossByWeekday,
      occupancy: {
        hours: occupancyHours,
        matrix: occupancyMatrix,
        max: maxOccupancy,
      },
    };
  }

  async getWeeklyLoad(dateFrom?: string, dateTo?: string, barberIds?: string[]) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom y dateTo son obligatorios.');
    }
    const localId = getCurrentLocalId();
    const normalizedBarberIds = Array.from(new Set((barberIds || []).filter(Boolean)));
    const where: Prisma.AppointmentWhereInput = {
      localId,
      status: { not: 'cancelled' },
      startDateTime: {
        gte: startOfDayInTimeZone(dateFrom, APP_TIMEZONE),
        lte: endOfDayInTimeZone(dateTo, APP_TIMEZONE),
      },
      ...(normalizedBarberIds.length > 0 ? { barberId: { in: normalizedBarberIds } } : {}),
    };

    const grouped = await this.prisma.appointment.groupBy({
      by: ['barberId'],
      where,
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    if (normalizedBarberIds.length > 0) {
      normalizedBarberIds.forEach((barberId) => {
        counts[barberId] = 0;
      });
    }
    grouped.forEach((item) => {
      counts[item.barberId] = item._count._all;
    });

    return { counts };
  }

  async findPage(params: AppointmentListFilters & { page: number; pageSize: number }) {
    const where = this.buildListWhere(params);
    const [total, appointments] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: this.buildListOrder(params),
        include: { service: true, products: { include: { product: true } } },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
      items: appointments.map(mapAppointment),
    };
  }

  async findPageWithClients(params: AppointmentListFilters & { page: number; pageSize: number }) {
    const where = this.buildListWhere(params);
    const [total, appointments] = await this.prisma.$transaction([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: this.buildListOrder(params),
        include: {
          service: true,
          products: { include: { product: true } },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    const clientMap = new Map<string, AdminSearchClient>();
    appointments.forEach((appointment) => {
      const user = appointment.user;
      if (!user) return;
      clientMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    });

    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
      items: appointments.map(mapAppointment),
      clients: Array.from(clientMap.values()),
    };
  }

  async findRangeWithClients(params: AppointmentListFilters) {
    const where = this.buildListWhere(params);
    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: this.buildListOrder(params),
      include: {
        service: true,
        products: { include: { product: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const clientMap = new Map<string, AdminCalendarClient>();
    appointments.forEach((appointment) => {
      const user = appointment.user;
      if (!user) return;
      clientMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    });

    return {
      items: appointments.map(mapAppointment),
      clients: Array.from(clientMap.values()),
    };
  }

  async findOne(id: string) {
    const localId = getCurrentLocalId();
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, localId },
      include: { service: true, products: { include: { product: true } } },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.syncAppointmentStatuses([appointment]);
    return mapAppointment(appointment);
  }

  private async calculateAppointmentPrice(serviceId: string, startDateTime: Date) {
    const localId = getCurrentLocalId();
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const offers = await this.prisma.offer.findMany({
      where: { active: true, localId, target: OfferTarget.service },
      include: { categories: true, services: true },
    });

    const pricing = computeServicePricing(
      service,
      offers.filter((offer) => isOfferActiveNow(offer, startDateTime)),
      startDateTime,
    );

    return { price: pricing.finalPrice ?? Number(service.price), serviceName: service.name };
  }

  private async getBarberNameSnapshot(barberId: string) {
    const localId = getCurrentLocalId();
    const barber = await this.prisma.barber.findFirst({
      where: { id: barberId, localId },
      select: { name: true },
    });
    if (!barber) {
      throw new NotFoundException('Barber not found');
    }
    return barber.name;
  }

  private async assertBarberServiceCompatibility(barberId: string, serviceId: string) {
    const localId = getCurrentLocalId();
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId, isArchived: false },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    await this.barbersService.assertBarberCanProvideService(barberId, serviceId);
  }

  async create(
    data: CreateAppointmentDto,
    context?: {
      requireConsent?: boolean;
      ip?: string | null;
      userAgent?: string | null;
      actorUserId?: string | null;
      skipNotifications?: boolean;
      payment?: {
        status?: PaymentStatus;
        method?: PaymentMethod | null;
        amount?: number;
        currency?: string;
        expiresAt?: Date | null;
        stripePaymentIntentId?: string | null;
        stripeCheckoutSessionId?: string | null;
      };
    },
  ) {
    const requireConsent = context?.requireConsent !== false;
    let consentRequired = requireConsent;
    if (requireConsent && data.userId) {
      const hasConsent = await this.legalService.hasUserPrivacyConsent(data.userId);
      if (hasConsent) {
        consentRequired = false;
      }
    }
    if (consentRequired && data.privacyConsentGiven !== true) {
      throw new BadRequestException('Se requiere aceptar la politica de privacidad.');
    }

    const localId = getCurrentLocalId();
    const startDateTime = new Date(data.startDateTime);
    const isAdminActor = Boolean(context?.actorUserId);
    const settings = await this.settingsService.getSettings();
    const productsConfig = settings.products;
    const requestedProducts = data.products ?? [];
    if (requestedProducts.length > 0) {
      if (!productsConfig.enabled) {
        throw new BadRequestException('Los productos no están habilitados en este local.');
      }
      if (!isAdminActor && !productsConfig.clientPurchaseEnabled) {
        throw new BadRequestException('La compra de productos no está disponible en este local.');
      }
    }

    await this.assertBarberServiceCompatibility(data.barberId, data.serviceId);

    await this.assertSlotAvailable({
      barberId: data.barberId,
      serviceId: data.serviceId,
      startDateTime: data.startDateTime,
    });

    const shopSchedule = await this.schedulesService.getShopSchedule();
    const bufferMinutes = shopSchedule.bufferMinutes ?? 0;
    const targetDuration = await this.getServiceDuration(data.serviceId);
    const pricing = await this.calculateAppointmentPrice(data.serviceId, startDateTime);
    const serviceName = pricing.serviceName;
    let servicePrice = pricing.price;
    const barberNameSnapshot = await this.getBarberNameSnapshot(data.barberId);
    const loyaltyDecision = await this.loyaltyService.resolveRewardDecision(data.userId, data.serviceId);
    const loyaltyProgramId = loyaltyDecision?.program.id ?? null;
    const loyaltyRewardApplied = loyaltyDecision?.isFreeNext ?? false;
    if (loyaltyRewardApplied) {
      servicePrice = 0;
    }
    const referralAttribution = await this.referralAttributionService.resolveAttributionForBooking({
      referralAttributionId: data.referralAttributionId ?? null,
      userId: data.userId ?? null,
      guestContact: data.guestContact ?? null,
    });
    const productSelection = await this.resolveProductSelection(requestedProducts, {
      allowInactive: isAdminActor,
      allowPrivate: isAdminActor,
      referenceDate: startDateTime,
    });
    let appliedCouponId: string | null = null;
    let couponDiscount = 0;
    if (data.appliedCouponId) {
      if (!data.userId) {
        throw new BadRequestException('Debes iniciar sesión para usar un cupón.');
      }
      if (loyaltyRewardApplied) {
        throw new BadRequestException('No puedes aplicar un cupón en una cita gratis.');
      }
      const coupon = await this.rewardsService.validateCoupon({
        userId: data.userId,
        couponId: data.appliedCouponId,
        serviceId: data.serviceId,
        referenceDate: startDateTime,
      });
      couponDiscount = this.rewardsService.calculateCouponDiscount({
        couponType: coupon.discountType,
        couponValue: coupon.discountValue ? Number(coupon.discountValue) : null,
        baseServicePrice: servicePrice,
      });
      appliedCouponId = coupon.id;
      servicePrice = Math.max(0, servicePrice - couponDiscount);
    }

    const totalBeforeWallet = servicePrice + productSelection.total;
    let walletAppliedAmount = 0;
    if (data.useWallet && data.userId) {
      const available = await this.rewardsService.getAvailableBalance(data.userId);
      walletAppliedAmount = Math.min(available, totalBeforeWallet);
    }
    const totalPrice = Math.max(0, totalBeforeWallet - walletAppliedAmount);
    const nextStatus = data.status || 'scheduled';
    const shouldHoldStock = this.shouldHoldStock(nextStatus);
    const paymentContext = context?.payment;
    const paymentStatus =
      paymentContext?.status ?? (totalPrice <= 0 ? PaymentStatus.exempt : PaymentStatus.in_person);
    const paymentAmount =
      typeof paymentContext?.amount === 'number' ? paymentContext.amount : totalPrice;
    const paymentCurrency = paymentContext?.currency || DEFAULT_CURRENCY;

    let appointment: AppointmentWithRelations;
    try {
      appointment = await this.prisma.$transaction(
        async (tx) => {
          await this.assertNoOverlappingAppointment(tx, {
            barberId: data.barberId,
            startDateTime,
            duration: targetDuration,
            bufferMinutes,
          });

          if (shouldHoldStock && productSelection.items.length > 0) {
            for (const item of productSelection.items) {
              if (item.product.stock < item.quantity) {
                throw new BadRequestException(`Stock insuficiente para "${item.product.name}".`);
              }
            }
            for (const item of productSelection.items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } },
              });
            }
          }

          const created = await tx.appointment.create({
            data: {
              localId,
              userId: data.userId,
              barberId: data.barberId,
              serviceId: data.serviceId,
              barberNameSnapshot,
              serviceNameSnapshot: serviceName,
              loyaltyProgramId,
              loyaltyRewardApplied,
              referralAttributionId: shouldHoldStock ? referralAttribution?.id ?? null : null,
              appliedCouponId: shouldHoldStock ? appliedCouponId : null,
              walletAppliedAmount: new Prisma.Decimal(shouldHoldStock ? walletAppliedAmount : 0),
              startDateTime,
              price: new Prisma.Decimal(totalPrice),
              paymentMethod: paymentContext?.method ?? null,
              paymentStatus,
              paymentAmount: new Prisma.Decimal(paymentAmount),
              paymentCurrency,
              paymentExpiresAt: paymentContext?.expiresAt ?? null,
              stripePaymentIntentId: paymentContext?.stripePaymentIntentId ?? null,
              stripeCheckoutSessionId: paymentContext?.stripeCheckoutSessionId ?? null,
              status: nextStatus,
              notes: data.notes,
              guestName: data.guestName,
              guestContact: data.guestContact,
              reminderSent: false,
              products: productSelection.items.length > 0
                ? {
                    create: productSelection.items.map((item) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                      unitPrice: new Prisma.Decimal(item.unitPrice),
                    })),
                  }
                : undefined,
            },
            include: { user: true, barber: true, service: true, products: { include: { product: true } } },
          });

          if (shouldHoldStock && referralAttribution) {
            await this.referralAttributionService.attachAttributionToAppointment({
              attributionId: referralAttribution.id,
              appointmentId: created.id,
              userId: data.userId ?? null,
              guestContact: data.guestContact ?? null,
              tx,
            });
          }

          if (shouldHoldStock && walletAppliedAmount > 0 && data.userId) {
            await this.rewardsService.reserveWalletHold(
              {
                userId: data.userId,
                appointmentId: created.id,
                amount: walletAppliedAmount,
                description: 'Reserva de saldo por cita programada.',
              },
              tx,
            );
          }

          if (shouldHoldStock && appliedCouponId && data.userId) {
            await this.rewardsService.reserveCouponUsage(
              {
                userId: data.userId,
                couponId: appliedCouponId,
                appointmentId: created.id,
                amount: couponDiscount,
                description: 'Cupón aplicado a cita programada.',
              },
              tx,
            );
          }

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isTransactionConflict(error)) {
        throw new BadRequestException('Horario no disponible.');
      }
      throw error;
    }

    if (nextStatus === 'completed') {
      await this.rewardsService.confirmWalletHold(appointment.id);
      await this.rewardsService.confirmCouponUsage(appointment.id);
      await this.referralAttributionService.handleAppointmentCompleted(appointment.id);
      await this.reviewRequestService.handleAppointmentCompleted(appointment.id);
    }

    if (consentRequired) {
      await this.legalService.recordPrivacyConsent({
        bookingId: appointment.id,
        locationId: localId,
        consentGiven: true,
        ip: context?.ip || null,
        userAgent: context?.userAgent || null,
        actorUserId: context?.actorUserId || null,
      });
    }

    if (!context?.skipNotifications && paymentStatus !== PaymentStatus.pending) {
      await this.notifyAppointment(appointment, 'creada');
    }
    return mapAppointment(appointment);
  }

  async sendPaymentConfirmation(appointmentId: string) {
    const localId = getCurrentLocalId();
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, localId },
      include: { user: true, barber: true, service: true },
    });
    if (!appointment) return;
    await this.notifyAppointment(appointment, 'creada');
  }

  async anonymizeAppointment(id: string, actorUserId?: string | null, reason = 'manual') {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.appointment.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Appointment not found');

    const shouldRedactGuest = !existing.userId;
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        guestName: shouldRedactGuest ? ANONYMIZED_NAME : existing.guestName,
        guestContact: shouldRedactGuest ? buildAnonymizedContact(id) : existing.guestContact,
        notes: null,
        anonymizedAt: new Date(),
      },
    });

    await this.auditLogs.log({
      locationId: localId,
      actorUserId: actorUserId || null,
      action: 'appointment.anonymized',
      entityType: 'appointment',
      entityId: id,
      metadata: { reason },
    });

    return mapAppointment(updated);
  }

  async update(id: string, data: UpdateAppointmentDto, context?: { actorUserId?: string | null }) {
    const localId = getCurrentLocalId();
    const current = await this.prisma.appointment.findFirst({
      where: { id, localId },
      include: { products: { include: { product: true } } },
    });
    if (!current) throw new NotFoundException('Appointment not found');
    if ((current.status === 'no_show' || current.status === 'cancelled') && data.status === 'completed') {
      throw new BadRequestException('Appointment marked as no-show or cancelled cannot be completed.');
    }
    if (current.status === 'completed' && data.status === 'scheduled') {
      throw new BadRequestException('Completed appointment cannot be set to scheduled.');
    }

    const nextServiceId = data.serviceId ?? current.serviceId;
    const nextBarberId = data.barberId ?? current.barberId;
    const nextUserId = data.userId === undefined ? current.userId : data.userId;
    const nextStartDateTime = data.startDateTime ? new Date(data.startDateTime) : current.startDateTime;
    if (data.status === 'completed') {
      const duration = await this.getServiceDuration(nextServiceId);
      const endTime = new Date(nextStartDateTime.getTime() + duration * 60 * 1000);
      const confirmationThreshold = new Date(endTime.getTime() + CONFIRMATION_GRACE_MS);
      if (new Date() < confirmationThreshold) {
        throw new BadRequestException('Appointment cannot be completed before it ends.');
      }
    }

    const nextStatus = data.status ?? current.status;
    const startChanged =
      data.startDateTime && new Date(data.startDateTime).getTime() !== current.startDateTime.getTime();
    const serviceChanged = data.serviceId !== undefined && data.serviceId !== current.serviceId;
    const barberChanged = data.barberId !== undefined && data.barberId !== current.barberId;
    const userChanged = data.userId !== undefined && data.userId !== current.userId;
    if (startChanged || serviceChanged || barberChanged) {
      await this.assertBarberServiceCompatibility(nextBarberId, nextServiceId);
      await this.assertSlotAvailable({
        barberId: data.barberId || current.barberId,
        serviceId: data.serviceId || current.serviceId,
        startDateTime: data.startDateTime || current.startDateTime.toISOString(),
        appointmentIdToIgnore: current.id,
      });
    }
    const statusChanged = nextStatus !== current.status;
    const isCancelled = statusChanged && nextStatus === 'cancelled';
    const productsInputProvided = Array.isArray(data.products);

    const isAdminActor = Boolean(context?.actorUserId);
    const settings = await this.settingsService.getSettings();

    if (isCancelled && !isAdminActor) {
      const cutoffHours = settings.appointments?.cancellationCutoffHours ?? 0;
      if (cutoffHours > 0) {
        const cutoffMs = cutoffHours * 60 * 60 * 1000;
        const timeUntil = nextStartDateTime.getTime() - Date.now();
        if (timeUntil <= cutoffMs) {
          throw new BadRequestException(
            `Solo puedes cancelar con más de ${cutoffHours}h de antelación.`,
          );
        }
      }
    }

    const productsConfig = settings.products;
    if (productsInputProvided && (data.products?.length ?? 0) > 0) {
      if (!productsConfig.enabled) {
        throw new BadRequestException('Los productos no están habilitados en este local.');
      }
      if (!isAdminActor && !productsConfig.clientPurchaseEnabled) {
        throw new BadRequestException('La compra de productos no está disponible en este local.');
      }
    }

    const shouldRecalculateLoyalty = serviceChanged || userChanged;
    let loyaltyProgramId = current.loyaltyProgramId ?? null;
    let loyaltyRewardApplied = current.loyaltyRewardApplied ?? false;
    if (shouldRecalculateLoyalty) {
      const loyaltyDecision = await this.loyaltyService.resolveRewardDecision(nextUserId, nextServiceId);
      loyaltyProgramId = loyaltyDecision?.program.id ?? null;
      loyaltyRewardApplied = loyaltyDecision?.isFreeNext ?? false;
    }

    const currentProducts = current.products ?? [];
    const currentProductsTotal = currentProducts.reduce(
      (acc, item) => acc + Number(item.unitPrice) * item.quantity,
      0,
    );
    const existingPriceMap = new Map(
      currentProducts.map((item) => [item.productId, Number(item.unitPrice)]),
    );
    const nextProductSelection = productsInputProvided
      ? await this.resolveProductSelection(data.products ?? [], {
          allowInactive: isAdminActor,
          allowPrivate: isAdminActor,
          referenceDate: nextStartDateTime,
          existingPrices: existingPriceMap,
        })
      : {
          items: currentProducts.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            product: item.product,
          })),
          total: currentProductsTotal,
        };

    let reminderSent: boolean | undefined;
    if (statusChanged) {
      reminderSent = nextStatus === 'cancelled' || nextStatus === 'no_show' ? true : false;
    } else if (startChanged) {
      reminderSent = false;
    }

    if (data.price !== undefined && !isAdminActor) {
      throw new ForbiddenException('Solo un admin puede modificar el precio final.');
    }
    if (data.paymentMethod !== undefined && !isAdminActor) {
      throw new ForbiddenException('Solo un admin puede actualizar el método de pago.');
    }
    if (
      !isAdminActor &&
      (data.referralAttributionId !== undefined ||
        data.appliedCouponId !== undefined ||
        data.walletAppliedAmount !== undefined)
    ) {
      throw new ForbiddenException('Solo un admin puede modificar recompensas.');
    }

    const shouldRecalculatePrice =
      data.serviceId !== undefined || data.startDateTime !== undefined || data.userId !== undefined;
    let price: Prisma.Decimal | undefined;
    let resolvedServiceName: string | null = null;
    let resolvedServicePrice: number | null = null;
    if (shouldRecalculatePrice) {
      const pricing = await this.calculateAppointmentPrice(nextServiceId, nextStartDateTime);
      resolvedServiceName = pricing.serviceName;
      resolvedServicePrice = loyaltyRewardApplied ? 0 : pricing.price;
    }
    if (data.price !== undefined) {
      price = new Prisma.Decimal(data.price);
    } else if (shouldRecalculatePrice || productsInputProvided) {
      const baseServicePrice = shouldRecalculatePrice
        ? resolvedServicePrice ?? 0
        : Math.max(0, Number(current.price) - currentProductsTotal);
      const walletAmount =
        data.walletAppliedAmount === undefined ? Number(current.walletAppliedAmount ?? 0) : data.walletAppliedAmount;
      const recalculatedTotal = Math.max(0, baseServicePrice + nextProductSelection.total - Math.max(0, walletAmount));
      price = new Prisma.Decimal(recalculatedTotal);
    }

    const snapshotUpdates: { barberNameSnapshot?: string; serviceNameSnapshot?: string } = {};
    if (serviceChanged || !current.serviceNameSnapshot) {
      if (!resolvedServiceName) {
        const service = await this.prisma.service.findFirst({
          where: { id: nextServiceId, localId },
          select: { name: true },
        });
        if (!service) throw new NotFoundException('Service not found');
        resolvedServiceName = service.name;
      }
      snapshotUpdates.serviceNameSnapshot = resolvedServiceName;
    }
    if (barberChanged || !current.barberNameSnapshot) {
      snapshotUpdates.barberNameSnapshot = await this.getBarberNameSnapshot(nextBarberId);
    }

    const shouldHoldCurrent = this.shouldHoldStock(current.status);
    const shouldHoldNext = this.shouldHoldStock(nextStatus);
    const productById = new Map<string, { stock: number; name: string }>();
    currentProducts.forEach((item) => {
      if (!item.product) return;
      productById.set(item.productId, { stock: item.product.stock, name: item.product.name });
    });
    nextProductSelection.items.forEach((item) => {
      if (!item.product) return;
      productById.set(item.productId, { stock: item.product.stock, name: item.product.name });
    });

    const stockAdjustments: Array<{ productId: string; delta: number }> = [];
    if (shouldHoldCurrent && !shouldHoldNext) {
      currentProducts.forEach((item) => {
        if (item.quantity > 0) {
          stockAdjustments.push({ productId: item.productId, delta: -item.quantity });
        }
      });
    } else if (!shouldHoldCurrent && shouldHoldNext) {
      nextProductSelection.items.forEach((item) => {
        if (item.quantity > 0) {
          stockAdjustments.push({ productId: item.productId, delta: item.quantity });
        }
      });
    } else if (shouldHoldCurrent && shouldHoldNext && productsInputProvided) {
      const currentQty = new Map(currentProducts.map((item) => [item.productId, item.quantity]));
      const nextQty = new Map(nextProductSelection.items.map((item) => [item.productId, item.quantity]));
      const ids = new Set([...currentQty.keys(), ...nextQty.keys()]);
      ids.forEach((id) => {
        const delta = (nextQty.get(id) ?? 0) - (currentQty.get(id) ?? 0);
        if (delta !== 0) {
          stockAdjustments.push({ productId: id, delta });
        }
      });
    }

    for (const adjustment of stockAdjustments) {
      if (adjustment.delta <= 0) continue;
      const productInfo = productById.get(adjustment.productId);
      if (!productInfo || productInfo.stock < adjustment.delta) {
        throw new BadRequestException(
          `Stock insuficiente para "${productInfo?.name ?? 'producto'}".`,
        );
      }
    }

    const shopSchedule = await this.schedulesService.getShopSchedule();
    const bufferMinutes = shopSchedule.bufferMinutes ?? 0;
    const nextDuration = await this.getServiceDuration(nextServiceId);

    let updated: AppointmentWithRelations;
    try {
      updated = await this.prisma.$transaction(
        async (tx) => {
          if (startChanged || serviceChanged || barberChanged) {
            await this.assertNoOverlappingAppointment(tx, {
              barberId: nextBarberId,
              startDateTime: nextStartDateTime,
              duration: nextDuration,
              bufferMinutes,
              appointmentIdToIgnore: current.id,
            });
          }

          for (const adjustment of stockAdjustments) {
            if (adjustment.delta > 0) {
              await tx.product.update({
                where: { id: adjustment.productId },
                data: { stock: { decrement: adjustment.delta } },
              });
            } else if (adjustment.delta < 0) {
              await tx.product.update({
                where: { id: adjustment.productId },
                data: { stock: { increment: Math.abs(adjustment.delta) } },
              });
            }
          }

          return tx.appointment.update({
            where: { id },
            data: {
              userId: data.userId,
              barberId: data.barberId,
              serviceId: data.serviceId,
              ...snapshotUpdates,
              loyaltyProgramId,
              loyaltyRewardApplied,
              referralAttributionId:
                data.referralAttributionId === undefined ? undefined : data.referralAttributionId,
              appliedCouponId: data.appliedCouponId === undefined ? undefined : data.appliedCouponId,
              walletAppliedAmount:
                data.walletAppliedAmount === undefined
                  ? undefined
                  : new Prisma.Decimal(data.walletAppliedAmount),
              startDateTime: data.startDateTime ? new Date(data.startDateTime) : undefined,
              price,
              paymentMethod: data.paymentMethod === undefined ? undefined : data.paymentMethod,
              status: data.status,
              notes: data.notes,
              guestName: data.guestName,
              guestContact: data.guestContact,
              reminderSent,
              products: productsInputProvided
                ? {
                    deleteMany: {},
                    create: nextProductSelection.items.map((item) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                      unitPrice: new Prisma.Decimal(item.unitPrice),
                    })),
                  }
                : undefined,
            },
            include: { user: true, barber: true, service: true, products: { include: { product: true } } },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isTransactionConflict(error)) {
        throw new BadRequestException('Horario no disponible.');
      }
      throw error;
    }

    if (statusChanged) {
      if (nextStatus === 'completed') {
        await this.rewardsService.confirmWalletHold(updated.id);
        await this.rewardsService.confirmCouponUsage(updated.id);
        await this.referralAttributionService.handleAppointmentCompleted(updated.id);
        await this.reviewRequestService.handleAppointmentCompleted(updated.id);
      }
      if (nextStatus === 'cancelled' || nextStatus === 'no_show') {
        await this.rewardsService.releaseWalletHold(updated.id);
        await this.rewardsService.cancelCouponUsage(updated.id);
        await this.referralAttributionService.handleAppointmentCancelled(updated.id);
      }
    }

    const shouldNotify = serviceChanged || barberChanged || startChanged;
    if (shouldNotify) {
      await this.notifyAppointment(updated, isCancelled ? 'cancelada' : 'actualizada');
    }
    return mapAppointment(updated);
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.appointment.findFirst({
      where: { id, localId },
      include: { products: { include: { product: true } } },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    await this.rewardsService.releaseWalletHold(existing.id);
    await this.rewardsService.cancelCouponUsage(existing.id);
    await this.referralAttributionService.handleAppointmentCancelled(existing.id);
    await this.prisma.$transaction(async (tx) => {
      if (this.shouldHoldStock(existing.status) && existing.products.length > 0) {
        for (const item of existing.products) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      await tx.appointment.delete({ where: { id } });
    });
    await this.auditLogs.log({
      locationId: localId,
      action: 'appointment.deleted',
      entityType: 'appointment',
      entityId: id,
      metadata: { status: existing.status },
    });
    return { success: true };
  }

  async syncStatusesForAllAppointments() {
    const localId = getCurrentLocalId();
    const appointments = await this.prisma.appointment.findMany({
      where: { status: { in: ['scheduled'] }, localId },
      include: { service: true },
    });
    return this.syncAppointmentStatuses(appointments);
  }

  private computeAvailableSlotsForBarber(params: {
    dateOnly: string;
    schedule: ShopSchedule;
    shopSchedule: ShopSchedule;
    appointments: AppointmentSlotRecord[];
    targetDuration: number;
  }): string[] {
    const { dateOnly, schedule, shopSchedule, appointments, targetDuration } = params;
    const bufferMinutes = shopSchedule.bufferMinutes ?? 0;
    const dayKey = getWeekdayKey(dateOnly, APP_TIMEZONE);
    const endOverflowMinutes = this.resolveEndOverflowMinutes({
      dateOnly,
      dayKey,
      barberSchedule: schedule,
      shopSchedule,
    });
    const daySchedule = (schedule || DEFAULT_SHOP_SCHEDULE)[dayKey];
    if (!daySchedule || daySchedule.closed) return [];
    const dayBreaks = [
      ...(shopSchedule.breaks?.[dayKey] ?? []),
      ...(shopSchedule.breaksByDate?.[dateOnly] ?? []),
    ];
    const targetDurationWithBuffer = targetDuration + Math.max(0, bufferMinutes);
    const normalizedEndOverflow = Math.max(0, Math.floor(endOverflowMinutes));

    const lastShiftKey = daySchedule.afternoon?.enabled ? 'afternoon' : daySchedule.morning?.enabled ? 'morning' : null;

    const getShiftLimits = (shift: { enabled: boolean; start: string; end: string }, applyOverflow: boolean) => {
      const startMinutes = timeToMinutes(shift.start);
      const endMinutes = timeToMinutes(shift.end);
      const maxEnd = applyOverflow
        ? Math.min(endMinutes + normalizedEndOverflow, 24 * 60 - 1)
        : endMinutes;
      return { startMinutes, endMinutes, maxEnd };
    };

    const generateSlotsForShiftWithOverflow = (
      shift: { enabled: boolean; start: string; end: string },
      applyOverflow: boolean,
    ) => {
      if (!shift.enabled) return [] as string[];
      const { startMinutes, endMinutes, maxEnd } = getShiftLimits(shift, applyOverflow);
      if (startMinutes >= endMinutes || targetDurationWithBuffer <= 0) return [];
      const slots: string[] = [];
      for (let current = startMinutes; current < endMinutes; current += SLOT_INTERVAL_MINUTES) {
        if (current + targetDurationWithBuffer <= maxEnd) {
          slots.push(minutesToTime(current));
        }
      }
      return slots;
    };

    const morningLimits = getShiftLimits(daySchedule.morning, lastShiftKey === 'morning');
    const afternoonLimits = getShiftLimits(daySchedule.afternoon, lastShiftKey === 'afternoon');

    const rawSlots = [
      ...generateSlotsForShiftWithOverflow(daySchedule.morning, lastShiftKey === 'morning'),
      ...generateSlotsForShiftWithOverflow(daySchedule.afternoon, lastShiftKey === 'afternoon'),
    ];
    if (rawSlots.length === 0) return [];
    const uniqueSlots = Array.from(new Set(rawSlots));

    const bookedRanges = appointments.map((appointment) => {
      const start = appointment.startDateTime;
      const startMinutes = timeToMinutes(formatTimeInTimeZone(start, APP_TIMEZONE));
      const duration = appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
      return { start: startMinutes, end: startMinutes + duration + Math.max(0, bufferMinutes) };
    });

    const baseSlots = uniqueSlots.filter((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + targetDurationWithBuffer;
      const overlapsBreak = dayBreaks.some((range) => {
        const breakStart = timeToMinutes(range.start);
        const breakEnd = timeToMinutes(range.end);
        return slotStart < breakEnd && slotEnd > breakStart;
      });
      if (overlapsBreak) return false;
      return bookedRanges.every((range) => slotEnd <= range.start || slotStart >= range.end);
    });

    const breakRanges = dayBreaks.map((range) => ({
      start: timeToMinutes(range.start),
      end: timeToMinutes(range.end),
    }));

    const blockedRanges = [...breakRanges, ...bookedRanges].filter((range) => range.end > range.start);

    const subtractRange = (intervals: Array<{ start: number; end: number }>, block: { start: number; end: number }) => {
      if (intervals.length === 0) return intervals;
      const next: Array<{ start: number; end: number }> = [];
      intervals.forEach((interval) => {
        if (block.end <= interval.start || block.start >= interval.end) {
          next.push(interval);
          return;
        }
        if (block.start > interval.start) {
          next.push({ start: interval.start, end: Math.min(block.start, interval.end) });
        }
        if (block.end < interval.end) {
          next.push({ start: Math.max(block.end, interval.start), end: interval.end });
        }
      });
      return next;
    };

    const getFreeIntervalsForShift = (
      shift: { enabled: boolean; start: string; end: string },
      limits: { startMinutes: number; endMinutes: number; maxEnd: number },
    ) => {
      if (!shift.enabled) return { intervals: [] as Array<{ start: number; end: number }>, shiftEnd: limits.endMinutes };
      if (limits.startMinutes >= limits.endMinutes) {
        return { intervals: [] as Array<{ start: number; end: number }>, shiftEnd: limits.endMinutes };
      }
      let intervals: Array<{ start: number; end: number }> = [{ start: limits.startMinutes, end: limits.maxEnd }];
      blockedRanges.forEach((block) => {
        intervals = subtractRange(intervals, block);
      });
      return {
        intervals: intervals.filter((interval) => interval.end > interval.start),
        shiftEnd: limits.endMinutes,
      };
    };

    const slotSet = new Set(baseSlots);
    const baseSlotMinutes = baseSlots.map(timeToMinutes);
    const minRequired = targetDurationWithBuffer;

    const maybeAddGapSlot = (interval: { start: number; end: number }, shiftEnd: number) => {
      if (interval.start >= shiftEnd) return;
      if (interval.end - interval.start < minRequired) return;
      const isGridAligned = interval.start % SLOT_INTERVAL_MINUTES === 0;
      if (!isGridAligned) {
        slotSet.add(minutesToTime(interval.start));
        return;
      }
      const latestStart = Math.min(interval.end - minRequired, shiftEnd - 1);
      if (latestStart < interval.start) return;
      const hasGridSlot = baseSlotMinutes.some((slotMinute) => slotMinute >= interval.start && slotMinute <= latestStart);
      if (!hasGridSlot) {
        slotSet.add(minutesToTime(interval.start));
      }
    };

    const morningFree = getFreeIntervalsForShift(daySchedule.morning, morningLimits);
    morningFree.intervals.forEach((interval) => maybeAddGapSlot(interval, morningFree.shiftEnd));

    const afternoonFree = getFreeIntervalsForShift(daySchedule.afternoon, afternoonLimits);
    afternoonFree.intervals.forEach((interval) => maybeAddGapSlot(interval, afternoonFree.shiftEnd));

    return Array.from(slotSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }

  private resolveEndOverflowFromSchedule(params: {
    schedule: ShopSchedule | null | undefined;
    dayKey: ReturnType<typeof getWeekdayKey>;
    dateOnly: string;
  }): number | null {
    const { schedule, dayKey, dateOnly } = params;
    if (!schedule) return null;
    const byDate = schedule.endOverflowByDate?.[dateOnly];
    if (typeof byDate === 'number' && Number.isFinite(byDate)) {
      return Math.max(0, Math.floor(byDate));
    }
    const byDay = schedule.endOverflowByDay?.[dayKey];
    if (typeof byDay === 'number' && Number.isFinite(byDay)) {
      return Math.max(0, Math.floor(byDay));
    }
    const global = schedule.endOverflowMinutes;
    if (typeof global === 'number' && Number.isFinite(global)) {
      return Math.max(0, Math.floor(global));
    }
    return null;
  }

  private resolveEndOverflowMinutes(params: {
    dateOnly: string;
    dayKey: ReturnType<typeof getWeekdayKey>;
    barberSchedule: ShopSchedule | null | undefined;
    shopSchedule: ShopSchedule | null | undefined;
  }): number {
    const { dateOnly, dayKey, barberSchedule, shopSchedule } = params;
    const barberValue = this.resolveEndOverflowFromSchedule({
      schedule: barberSchedule,
      dayKey,
      dateOnly,
    });
    if (barberValue !== null) return barberValue;
    const shopValue = this.resolveEndOverflowFromSchedule({
      schedule: shopSchedule,
      dayKey,
      dateOnly,
    });
    return shopValue ?? 0;
  }

  async getAvailableSlots(
    barberId: string,
    date: string,
    options?: { serviceId?: string; appointmentIdToIgnore?: string },
  ): Promise<string[]> {
    const localId = getCurrentLocalId();
    const barber = await this.prisma.barber.findFirst({
      where: { id: barberId, localId },
    });
    const dateOnly = date.split('T')[0];
    if (!barber || barber.isActive === false) return [];

    if (options?.serviceId) {
      const canProvideService = await this.barbersService.isBarberAllowedForService(
        barberId,
        options.serviceId,
      );
      if (!canProvideService) return [];
    }

    const startDate = barber.startDate ? barber.startDate.toISOString().split('T')[0] : null;
    const endDate = barber.endDate ? barber.endDate.toISOString().split('T')[0] : null;
    if (startDate && dateOnly < startDate) return [];
    if (endDate && dateOnly > endDate) return [];

    const [schedule, shopSchedule, generalHolidays, barberHolidays, targetDuration] = await Promise.all([
      this.schedulesService.getBarberSchedule(barberId),
      this.schedulesService.getShopSchedule(),
      this.holidaysService.getGeneralHolidays(),
      this.holidaysService.getBarberHolidays(barberId),
      this.getServiceDuration(options?.serviceId),
    ]);

    if (generalHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) return [];
    if (barberHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) return [];

    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId,
        barberId,
        status: { not: 'cancelled' },
        startDateTime: {
          gte: startOfDayInTimeZone(dateOnly, APP_TIMEZONE),
          lte: endOfDayInTimeZone(dateOnly, APP_TIMEZONE),
        },
        NOT: options?.appointmentIdToIgnore ? { id: options.appointmentIdToIgnore } : undefined,
      },
      include: { service: true },
    });

    return this.computeAvailableSlotsForBarber({
      dateOnly,
      schedule,
      shopSchedule,
      appointments,
      targetDuration,
    });
  }

  async getAvailableSlotsBatch(
    date?: string,
    barberIds?: string[],
    options?: { serviceId?: string; appointmentIdToIgnore?: string },
  ): Promise<Record<string, string[]>> {
    if (!date) {
      throw new BadRequestException('date es obligatorio.');
    }
    const normalizedBarberIds = Array.from(new Set((barberIds || []).filter(Boolean)));
    if (normalizedBarberIds.length === 0) {
      return {};
    }
    if (normalizedBarberIds.length > 30) {
      throw new BadRequestException('Maximo 30 barberIds por solicitud.');
    }

    const localId = getCurrentLocalId();
    const dateOnly = date.split('T')[0];
    const emptyResponse = Object.fromEntries(
      normalizedBarberIds.map((barberId) => [barberId, [] as string[]]),
    );

    const [
      targetDuration,
      shopSchedule,
      generalHolidays,
      barbers,
      barberSchedules,
      barberHolidaysRaw,
      appointments,
      eligibleBarberIds,
    ] = await Promise.all([
      this.getServiceDuration(options?.serviceId),
      this.schedulesService.getShopSchedule(),
      this.holidaysService.getGeneralHolidays(),
      this.prisma.barber.findMany({
        where: { localId, id: { in: normalizedBarberIds } },
        select: { id: true, isActive: true, startDate: true, endDate: true },
      }),
      this.prisma.barberSchedule.findMany({
        where: { localId, barberId: { in: normalizedBarberIds } },
        select: { barberId: true, data: true },
      }),
      this.prisma.barberHoliday.findMany({
        where: { localId, barberId: { in: normalizedBarberIds } },
        select: { barberId: true, start: true, end: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          localId,
          barberId: { in: normalizedBarberIds },
          status: { not: 'cancelled' },
          startDateTime: {
            gte: startOfDayInTimeZone(dateOnly, APP_TIMEZONE),
            lte: endOfDayInTimeZone(dateOnly, APP_TIMEZONE),
          },
          NOT: options?.appointmentIdToIgnore ? { id: options.appointmentIdToIgnore } : undefined,
        },
        include: { service: { select: { duration: true } } },
      }),
      options?.serviceId
        ? this.barbersService.getEligibleBarberIdsForService(options.serviceId, normalizedBarberIds)
        : Promise.resolve(normalizedBarberIds),
    ]);

    if (generalHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) {
      return emptyResponse;
    }

    const barberById = new Map(barbers.map((barber) => [barber.id, barber]));
    const fallbackSchedule = normalizeSchedule(shopSchedule, { preserveEndOverflowUndefined: true });
    const scheduleByBarberId = new Map(
      barberSchedules.map((record) => [
        record.barberId,
        normalizeSchedule(record.data as Partial<ShopSchedule>, { preserveEndOverflowUndefined: true }),
      ]),
    );
    const barberHolidaysByBarberId = new Map<string, Array<{ start: string; end: string }>>();
    barberHolidaysRaw.forEach((holiday) => {
      const existing = barberHolidaysByBarberId.get(holiday.barberId) || [];
      existing.push(
        normalizeRange({
          start: holiday.start.toISOString().split('T')[0],
          end: holiday.end.toISOString().split('T')[0],
        }),
      );
      barberHolidaysByBarberId.set(holiday.barberId, existing);
    });
    const appointmentsByBarberId = new Map<string, AppointmentSlotRecord[]>();
    appointments.forEach((appointment) => {
      const existing = appointmentsByBarberId.get(appointment.barberId) || [];
      existing.push({
        startDateTime: appointment.startDateTime,
        service: appointment.service,
      });
      appointmentsByBarberId.set(appointment.barberId, existing);
    });
    const eligibleSet = new Set(eligibleBarberIds);

    const response: Record<string, string[]> = {};
    normalizedBarberIds.forEach((barberId) => {
      const barber = barberById.get(barberId);
      if (!barber || barber.isActive === false) {
        response[barberId] = [];
        return;
      }

      if (options?.serviceId && !eligibleSet.has(barberId)) {
        response[barberId] = [];
        return;
      }

      const startDate = barber.startDate ? barber.startDate.toISOString().split('T')[0] : null;
      const endDate = barber.endDate ? barber.endDate.toISOString().split('T')[0] : null;
      if ((startDate && dateOnly < startDate) || (endDate && dateOnly > endDate)) {
        response[barberId] = [];
        return;
      }

      const barberHolidays = barberHolidaysByBarberId.get(barberId) || [];
      if (barberHolidays.some((range) => isDateInRange(dateOnly, range))) {
        response[barberId] = [];
        return;
      }

      const schedule = scheduleByBarberId.get(barberId) || fallbackSchedule;
      const barberAppointments = appointmentsByBarberId.get(barberId) || [];
      response[barberId] = this.computeAvailableSlotsForBarber({
        dateOnly,
        schedule,
        shopSchedule,
        appointments: barberAppointments,
        targetDuration,
      });
    });

    return response;
  }

  private async notifyAppointment(appointment: any, action: 'creada' | 'actualizada' | 'cancelada') {
    const contact = this.getContact(appointment.user, appointment.guestName, appointment.guestContact);
    const allowEmail = appointment.user ? appointment.user.notificationEmail !== false : true;
    if (allowEmail) {
      await this.notificationsService.sendAppointmentEmail(
        contact,
        {
          date: appointment.startDateTime,
          serviceName: appointment.service?.name,
          barberName: appointment.barber?.name,
        },
        action,
      );
    }
  }

  private getContact(user: any, guestName?: string | null, guestContact?: string | null) {
    const emailCandidate = user?.email || (guestContact?.includes('@') ? guestContact : null);
    const phoneCandidate = user?.phone || (!guestContact?.includes('@') ? guestContact : null);
    return {
      email: emailCandidate || null,
      phone: phoneCandidate || null,
      name: user?.name || guestName || null,
    };
  }

  private async syncAppointmentStatuses(
    appointments: Array<{ id: string; status: AppointmentStatus; startDateTime: Date; service?: { duration?: number | null } | null }>,
  ) {
    const now = new Date();
    const updates: Promise<unknown>[] = [];
    let updatedCount = 0;
    const completedIds: string[] = [];

    appointments.forEach((appointment) => {
      if (appointment.status === 'cancelled' || appointment.status === 'completed' || appointment.status === 'no_show') {
        return;
      }

      const duration = appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
      const endTime = new Date(appointment.startDateTime.getTime() + duration * 60 * 1000);
      const confirmationThreshold = new Date(endTime.getTime() + CONFIRMATION_GRACE_MS);
      const nextStatus = now >= confirmationThreshold ? 'completed' : 'scheduled';

      if (appointment.status !== nextStatus) {
        appointment.status = nextStatus;
        updatedCount += 1;
        if (nextStatus === 'completed') {
          completedIds.push(appointment.id);
        }
        updates.push(
          this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: nextStatus },
          }),
        );
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
    }
    const BATCH_SIZE = 20;
    for (let index = 0; index < completedIds.length; index += BATCH_SIZE) {
      const batch = completedIds.slice(index, index + BATCH_SIZE);
      await Promise.all(
        batch.map(async (id) => {
          await Promise.all([
            this.rewardsService.confirmWalletHold(id),
            this.rewardsService.confirmCouponUsage(id),
            this.referralAttributionService.handleAppointmentCompleted(id),
            this.reviewRequestService.handleAppointmentCompleted(id),
          ]);
        }),
      );
    }
    return updatedCount;
  }
}
