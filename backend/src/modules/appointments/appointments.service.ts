import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, OfferTarget, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { mapAppointment } from './appointments.mapper';
import { isDateInRange, minutesToTime, normalizeRange, timeToMinutes } from '../schedules/schedule.utils';
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
import { ReferralAttributionService } from '../referrals/referral-attribution.service';
import { RewardsService } from '../referrals/rewards.service';
import { ReviewRequestService } from '../reviews/review-request.service';
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
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const ANONYMIZED_NAME = 'Invitado anonimizado';

const buildAnonymizedContact = (id: string) => `anonimo+${id.slice(0, 8)}@example.invalid`;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { user: true; barber: true; service: true; products: { include: { product: true } } };
}>;

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
    const endOverflowMinutes = schedule.endOverflowMinutes ?? shopSchedule.endOverflowMinutes ?? 0;
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
    for (const id of completedIds) {
      await this.rewardsService.confirmWalletHold(id);
      await this.rewardsService.confirmCouponUsage(id);
      await this.referralAttributionService.handleAppointmentCompleted(id);
      await this.reviewRequestService.handleAppointmentCompleted(id);
    }
    return updatedCount;
  }
}
