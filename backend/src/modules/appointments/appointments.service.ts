import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, OfferTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { mapAppointment } from './appointments.mapper';
import { generateSlotsForShift, isDateInRange, normalizeRange, timeToMinutes } from '../schedules/schedule.utils';
import { HolidaysService } from '../holidays/holidays.service';
import { SchedulesService } from '../schedules/schedules.service';
import { DEFAULT_SHOP_SCHEDULE } from '../schedules/schedule.types';
import { NotificationsService } from '../notifications/notifications.service';
import { computeServicePricing, isOfferActiveNow } from '../services/services.pricing';
import { LegalService } from '../legal/legal.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SettingsService } from '../settings/settings.service';
import { computeProductPricing } from '../products/products.pricing';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  APP_TIMEZONE,
  endOfDayInTimeZone,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getWeekdayKey,
  startOfDayInTimeZone,
} from '../../utils/timezone';

const DEFAULT_SERVICE_DURATION = 30;
const SLOT_INTERVAL_MINUTES = 15;
const CONFIRMATION_GRACE_MS = 60 * 1000;
const ANONYMIZED_NAME = 'Invitado anonimizado';

const buildAnonymizedContact = (id: string) => `anonimo+${id.slice(0, 8)}@example.invalid`;

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
  ) {}

  private async getServiceDuration(serviceId?: string) {
    if (!serviceId) return DEFAULT_SERVICE_DURATION;
    const localId = getCurrentLocalId();
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId },
    });
    return service?.duration ?? DEFAULT_SERVICE_DURATION;
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

  async findAll(filters?: { userId?: string; barberId?: string; date?: string }) {
    const localId = getCurrentLocalId();
    const where: any = { localId };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.barberId) where.barberId = filters.barberId;
    if (filters?.date) {
      where.startDateTime = {
        gte: startOfDayInTimeZone(filters.date, APP_TIMEZONE),
        lte: endOfDayInTimeZone(filters.date, APP_TIMEZONE),
      };
    }
    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startDateTime: 'asc' },
      include: { service: true, products: { include: { product: true } } },
    });
    await this.syncAppointmentStatuses(appointments);
    return appointments.map(mapAppointment);
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

  async create(
    data: CreateAppointmentDto,
    context?: { requireConsent?: boolean; ip?: string | null; userAgent?: string | null; actorUserId?: string | null },
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

    await this.assertSlotAvailable({
      barberId: data.barberId,
      serviceId: data.serviceId,
      startDateTime: data.startDateTime,
    });

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
    const productSelection = await this.resolveProductSelection(requestedProducts, {
      allowInactive: isAdminActor,
      allowPrivate: isAdminActor,
      referenceDate: startDateTime,
    });
    const totalPrice = servicePrice + productSelection.total;
    const nextStatus = data.status || 'scheduled';
    const shouldHoldStock = this.shouldHoldStock(nextStatus);

    const appointment = await this.prisma.$transaction(async (tx) => {
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

      return tx.appointment.create({
        data: {
          localId,
          userId: data.userId,
          barberId: data.barberId,
          serviceId: data.serviceId,
          barberNameSnapshot,
          serviceNameSnapshot: serviceName,
          loyaltyProgramId,
          loyaltyRewardApplied,
          startDateTime,
          price: new Prisma.Decimal(totalPrice),
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
    });

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

    await this.notifyAppointment(appointment, 'creada');
    return mapAppointment(appointment);
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
      price = new Prisma.Decimal(baseServicePrice + nextProductSelection.total);
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

    const updated = await this.prisma.$transaction(async (tx) => {
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
    });

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

    const startDate = barber.startDate ? barber.startDate.toISOString().split('T')[0] : null;
    const endDate = barber.endDate ? barber.endDate.toISOString().split('T')[0] : null;
    if (startDate && dateOnly < startDate) return [];
    if (endDate && dateOnly > endDate) return [];

    const schedule = await this.schedulesService.getBarberSchedule(barberId);
    const shopSchedule = await this.schedulesService.getShopSchedule();
    const bufferMinutes = shopSchedule.bufferMinutes ?? 0;
    const dayKey = getWeekdayKey(dateOnly, APP_TIMEZONE);
    const daySchedule = (schedule || DEFAULT_SHOP_SCHEDULE)[dayKey];
    if (!daySchedule || daySchedule.closed) return [];
    const dayBreaks = shopSchedule.breaks?.[dayKey] ?? [];

    const generalHolidays = await this.holidaysService.getGeneralHolidays();
    if (generalHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) return [];
    const barberHolidays = await this.holidaysService.getBarberHolidays(barberId);
    if (barberHolidays.some((range) => isDateInRange(dateOnly, normalizeRange(range)))) return [];

    const targetDuration = await this.getServiceDuration(options?.serviceId);
    const targetDurationWithBuffer = targetDuration + Math.max(0, bufferMinutes);
    const rawSlots = [
      ...generateSlotsForShift(daySchedule.morning, targetDurationWithBuffer, SLOT_INTERVAL_MINUTES),
      ...generateSlotsForShift(daySchedule.afternoon, targetDurationWithBuffer, SLOT_INTERVAL_MINUTES),
    ];
    if (rawSlots.length === 0) return [];
    const uniqueSlots = Array.from(new Set(rawSlots));

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

    const bookedRanges = appointments.map((appointment) => {
      const start = appointment.startDateTime;
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const duration = appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
      return { start: startMinutes, end: startMinutes + duration + Math.max(0, bufferMinutes) };
    });

    return uniqueSlots.filter((slot) => {
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
    return updatedCount;
  }
}
