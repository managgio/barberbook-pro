import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, OfferTarget, PaymentStatus, Prisma } from '@prisma/client';
import { APP_TIMEZONE, formatDateInTimeZone, formatTimeInTimeZone, endOfDayInTimeZone, startOfDayInTimeZone } from '../../../utils/timezone';
import { isOfferActiveNow } from '../../services/services.pricing';
import { computeProductPricing } from '../../products/products.pricing';
import { SettingsService } from '../../settings/settings.service';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';
import { SchedulesService } from '../../schedules/schedules.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BarbersService } from '../../barbers/barbers.service';
import { LegalService } from '../../legal/legal.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { mapAppointment } from '../appointments.mapper';
import { buildLegacyGuestContact, parseGuestContact } from '../../../shared/domain/guest-contact';
import { CreateAppointmentCommand } from '../../../contexts/booking/application/commands/create-appointment.command';
import { RemoveAppointmentCommand } from '../../../contexts/booking/application/commands/remove-appointment.command';
import { UpdateAppointmentCommand } from '../../../contexts/booking/application/commands/update-appointment.command';
import {
  BookingStatus,
  getAdminPermissionViolationMessage,
  getCancellationCutoffViolationMessage,
  getCompletionTimingViolationMessage,
  getInvalidStatusTransitionMessage,
} from '../../../contexts/booking/domain/services/update-appointment-policy';
import {
  BookingStatusSideEffectsStatus,
  RunAppointmentStatusSideEffectsUseCase,
} from '../../../contexts/booking/application/use-cases/run-appointment-status-side-effects.use-case';
import { GetAvailabilityUseCase } from '../../../contexts/booking/application/use-cases/get-availability.use-case';
import { BookingCommandPort } from '../../../contexts/booking/ports/outbound/booking-command.port';
import {
  COMMERCE_SERVICE_PRICING_PORT,
  CommerceServicePricingPort,
} from '../../../contexts/commerce/ports/outbound/service-pricing.port';
import {
  COMMERCE_SUBSCRIPTION_POLICY_PORT,
  CommerceSubscriptionPolicyPort,
} from '../../../contexts/commerce/ports/outbound/subscription-policy.port';
import {
  COMMERCE_LOYALTY_POLICY_PORT,
  CommerceLoyaltyPolicyPort,
} from '../../../contexts/commerce/ports/outbound/loyalty-policy.port';
import {
  COMMERCE_WALLET_LEDGER_PORT,
  CommerceWalletLedgerPort,
} from '../../../contexts/commerce/ports/outbound/wallet-ledger.port';
import {
  ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT,
  EngagementReferralAttributionPort,
} from '../../../contexts/engagement/ports/outbound/referral-attribution.port';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { NotifyEarlierSlotOpportunityUseCase } from '../../../contexts/booking/application/use-cases/notify-earlier-slot-opportunity.use-case';
import {
  AppointmentReminderChannel,
  normalizeAppointmentReminderChannels,
} from '../../../shared/domain/appointment-reminder-channel';
import { normalizeSmsRecipient } from '../../../contexts/engagement/domain/services/sms-recipient.policy';

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { user: true; barber: true; service: true; serviceItems: true; products: { include: { product: true } } };
}>;

const DEFAULT_SERVICE_DURATION = 30;
const CONFIRMATION_GRACE_MS = 60 * 1000;
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const DEFAULT_SLOT_INTERVAL_MINUTES = 15;

@Injectable()
export class ModuleBookingCommandAdapter implements BookingCommandPort {
  private readonly logger = new Logger(ModuleBookingCommandAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly runAppointmentStatusSideEffectsUseCase: RunAppointmentStatusSideEffectsUseCase,
    private readonly notifyEarlierSlotOpportunityUseCase: NotifyEarlierSlotOpportunityUseCase,
    private readonly settingsService: SettingsService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly schedulesService: SchedulesService,
    private readonly notificationsService: NotificationsService,
    private readonly barbersService: BarbersService,
    private readonly legalService: LegalService,
    private readonly getAvailabilityUseCase: GetAvailabilityUseCase,
    @Inject(COMMERCE_SERVICE_PRICING_PORT)
    private readonly commerceServicePricingPort: CommerceServicePricingPort,
    @Inject(COMMERCE_SUBSCRIPTION_POLICY_PORT)
    private readonly commerceSubscriptionPolicyPort: CommerceSubscriptionPolicyPort,
    @Inject(COMMERCE_LOYALTY_POLICY_PORT)
    private readonly commerceLoyaltyPolicyPort: CommerceLoyaltyPolicyPort,
    @Inject(COMMERCE_WALLET_LEDGER_PORT)
    private readonly commerceWalletLedgerPort: CommerceWalletLedgerPort,
    @Inject(ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT)
    private readonly engagementReferralAttributionPort: EngagementReferralAttributionPort,
  ) {}

  private isTransactionConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private async getServiceDuration(localId: string, serviceId?: string) {
    if (!serviceId) return DEFAULT_SERVICE_DURATION;
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId },
      select: { duration: true },
    });
    return service?.duration ?? DEFAULT_SERVICE_DURATION;
  }

  private normalizeServiceIds(primaryServiceId: string, serviceIds?: string[]) {
    const normalized = Array.from(new Set(
      [primaryServiceId, ...(serviceIds || [])]
        .map((serviceId) => serviceId?.trim())
        .filter((serviceId): serviceId is string => Boolean(serviceId)),
    ));
    if (normalized.length > 6) {
      throw new BadRequestException('Puedes combinar un máximo de 6 servicios.');
    }
    return normalized;
  }

  private async assertMultiServiceBookingEnabled(serviceIds: string[], settings: Awaited<ReturnType<SettingsService['getSettings']>>) {
    if (serviceIds.length <= 1) return;
    const brandConfig = await this.tenantConfigService.getBrandConfig();
    if (
      brandConfig.features?.multiServiceBookingEnabled !== true
      || settings.appointments?.multiServiceEnabled !== true
    ) {
      throw new BadRequestException('La reserva de varios servicios no está habilitada.');
    }
  }

  private async resolveServiceBundle(localId: string, serviceIds: string[], referenceDate: Date) {
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, localId, isArchived: false },
      select: { id: true, name: true, duration: true },
    });
    if (services.length !== serviceIds.length) {
      throw new NotFoundException('Uno o varios servicios no existen en este local.');
    }
    const serviceById = new Map(services.map((service) => [service.id, service]));
    const items = await Promise.all(serviceIds.map(async (serviceId, position) => {
      const service = serviceById.get(serviceId)!;
      const pricing = await this.calculateAppointmentPrice(localId, serviceId, referenceDate);
      return {
        serviceId,
        position,
        name: pricing.serviceName || service.name,
        durationMinutes: service.duration,
        price: pricing.price,
      };
    }));
    return {
      items,
      durationMinutes: items.reduce((total, item) => total + item.durationMinutes, 0),
      price: items.reduce((total, item) => total + item.price, 0),
      name: items.map((item) => item.name).join(' + '),
    };
  }

  private async assertNoOverlappingAppointment(
    tx: Prisma.TransactionClient,
    params: {
      localId: string;
      barberId: string;
      startDateTime: Date;
      duration: number;
      bufferMinutes: number;
      appointmentIdToIgnore?: string;
    },
  ) {
    const dateOnly = formatDateInTimeZone(params.startDateTime, APP_TIMEZONE);
    const appointments = await tx.appointment.findMany({
      where: {
        localId: params.localId,
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
      const existingDuration = appointment.totalDurationMinutes ?? appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
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
    context: CreateAppointmentCommand['context'] | UpdateAppointmentCommand['context'];
    barberId: string;
    serviceId?: string;
    serviceIds?: string[];
    startDateTime: string;
    appointmentIdToIgnore?: string;
    slotIntervalMinutes?: number;
  }) {
    const startDate = new Date(params.startDateTime);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Horario no disponible.');
    }

    const dateOnly = formatDateInTimeZone(startDate, APP_TIMEZONE);
    const slotTime = formatTimeInTimeZone(startDate, APP_TIMEZONE);
    const availableSlots = await this.getAvailabilityUseCase.execute({
      context: params.context,
      barberId: params.barberId,
      date: dateOnly,
      serviceId: params.serviceId,
      serviceIds: params.serviceIds,
      appointmentIdToIgnore: params.appointmentIdToIgnore,
      slotIntervalMinutes: params.slotIntervalMinutes,
    });

    if (!availableSlots.includes(slotTime)) {
      throw new BadRequestException('Horario no disponible.');
    }
  }

  private shouldHoldStock(status: AppointmentStatus | string) {
    return status !== 'cancelled' && status !== 'no_show';
  }

  private resolveSlotIntervalMinutes(value: number | null | undefined) {
    return value === 30 ? 30 : DEFAULT_SLOT_INTERVAL_MINUTES;
  }

  private isValidReminderPhone(value?: string | null) {
    return normalizeSmsRecipient(value) !== null;
  }

  private async resolveGuestReminderConsent(params: {
    userId?: string | null;
    phone?: string | null;
    requestedChannels?: AppointmentReminderChannel[];
  }) {
    const requestedChannels = normalizeAppointmentReminderChannels(params.requestedChannels);
    if (requestedChannels.length === 0) {
      return { sms: false, whatsapp: false };
    }
    if (params.userId) {
      throw new BadRequestException(
        'Los recordatorios de usuarios registrados se gestionan desde sus preferencias.',
      );
    }
    if (!this.isValidReminderPhone(params.phone)) {
      throw new BadRequestException(
        'Necesitamos un teléfono válido para activar recordatorios.',
      );
    }

    const config = await this.tenantConfigService.getPublicConfig();
    for (const channel of requestedChannels) {
      if (config.notificationCapabilities?.[channel] !== true) {
        throw new BadRequestException(
          `El canal de recordatorio ${channel} no está disponible en este local.`,
        );
      }
    }

    return {
      sms: requestedChannels.includes('sms'),
      whatsapp: requestedChannels.includes('whatsapp'),
    };
  }

  private async getProductOffers(localId: string, referenceDate: Date) {
    const offers = await this.prisma.offer.findMany({
      where: { active: true, localId, target: OfferTarget.product },
      include: { productCategories: true, products: true },
    });
    return offers.filter((offer) => isOfferActiveNow(offer, referenceDate));
  }

  private async resolveProductSelection(
    localId: string,
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

    const offers = await this.getProductOffers(localId, options.referenceDate);
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

  private async calculateAppointmentPrice(localId: string, serviceId: string, startDateTime: Date) {
    const pricing = await this.commerceServicePricingPort.calculateServicePrice({
      localId,
      serviceId,
      referenceDate: startDateTime,
    });
    return {
      price: pricing.finalPrice,
      serviceName: pricing.serviceName,
    };
  }

  private async getBarberNameSnapshot(localId: string, barberId: string) {
    const barber = await this.prisma.barber.findFirst({
      where: { id: barberId, localId },
      select: { name: true },
    });
    if (!barber) {
      throw new NotFoundException('Barber not found');
    }
    return barber.name;
  }

  private async assertBarberServiceCompatibility(localId: string, barberId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId, isArchived: false },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    await this.barbersService.assertBarberCanProvideService(barberId, serviceId);
  }

  private async assertBarberServicesCompatibility(localId: string, barberId: string, serviceIds: string[]) {
    await Promise.all(serviceIds.map((serviceId) =>
      this.assertBarberServiceCompatibility(localId, barberId, serviceId),
    ));
  }

  private async runStatusSideEffects(localId: string, appointmentId: string, nextStatus: AppointmentStatus) {
    const result = await this.runAppointmentStatusSideEffectsUseCase.execute({
      localId,
      appointmentId,
      nextStatus: nextStatus as BookingStatusSideEffectsStatus,
    });

    result.failures.forEach((failure) => {
      this.logger.error(
        `Post-status side effect failed (${failure.effect}) for appointment ${appointmentId}: ${failure.message}`,
      );
    });
  }

  private async notifyEarlierSlotOpportunity(params: {
    context: CreateAppointmentCommand['context'] | UpdateAppointmentCommand['context'];
    appointmentId: string;
    barberId: string;
    startDateTime: Date;
  }) {
    try {
      await this.notifyEarlierSlotOpportunityUseCase.execute({
        context: params.context,
        releasedAppointmentId: params.appointmentId,
        barberId: params.barberId,
        releasedStartDateTime: params.startDateTime,
      });
    } catch (error) {
      this.logger.error(
        `Earlier-slot opportunity processing failed for appointment ${params.appointmentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getContact(
    user: any,
    guestName?: string | null,
    guestContact?: string | null,
    guestEmail?: string | null,
    guestPhone?: string | null,
  ) {
    const structuredGuestContact = parseGuestContact({ guestContact, guestEmail, guestPhone });
    return {
      email: user?.email || structuredGuestContact.email,
      phone: user?.phone || structuredGuestContact.phone,
      name: user?.name || guestName || null,
    };
  }

  private async notifyAppointment(appointment: AppointmentWithRelations, action: 'creada' | 'actualizada' | 'cancelada') {
    const contact = this.getContact(
      appointment.user,
      appointment.guestName,
      appointment.guestContact,
      appointment.guestEmail,
      appointment.guestPhone,
    );
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

  createAppointment(command: CreateAppointmentCommand): Promise<unknown> {
    return this.createAppointmentWithPrisma(command);
  }

  private async createAppointmentWithPrisma(command: CreateAppointmentCommand): Promise<unknown> {
    const data = command.input;
    const structuredGuestContact = parseGuestContact(data);
    const legacyGuestContact = data.guestContact?.trim() || buildLegacyGuestContact(structuredGuestContact);
    const guestReminderConsent = await this.resolveGuestReminderConsent({
      userId: data.userId,
      phone: structuredGuestContact.phone,
      requestedChannels: data.reminderChannels,
    });
    const requireConsent = command.execution?.requireConsent !== false;
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

    const localId = command.context.localId;
    const startDateTime = new Date(data.startDateTime);
    const isAdminActor = Boolean(command.execution?.actorUserId);
    const settings = await this.settingsService.getSettings();
    const slotIntervalMinutes = this.resolveSlotIntervalMinutes(
      settings.appointments?.slotIntervalMinutes,
    );
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

    const serviceIds = this.normalizeServiceIds(data.serviceId, data.serviceIds);
    await this.assertMultiServiceBookingEnabled(serviceIds, settings);
    await this.assertBarberServicesCompatibility(localId, data.barberId, serviceIds);
    await this.assertSlotAvailable({
      context: command.context,
      barberId: data.barberId,
      serviceId: data.serviceId,
      serviceIds,
      startDateTime: data.startDateTime,
      slotIntervalMinutes,
    });

    const shopSchedule = await this.schedulesService.getShopSchedule();
    const bufferMinutes = shopSchedule.bufferMinutes ?? 0;
    const serviceBundle = await this.resolveServiceBundle(localId, serviceIds, startDateTime);
    const targetDuration = serviceBundle.durationMinutes;
    const serviceName = serviceBundle.name;
    const primaryServicePrice = serviceBundle.items[0]?.price ?? 0;
    const additionalServicesPrice = Math.max(0, serviceBundle.price - primaryServicePrice);
    let primaryServicePayable = primaryServicePrice;
    const barberNameSnapshot = await this.getBarberNameSnapshot(localId, data.barberId);
    const activeSubscription = await this.commerceSubscriptionPolicyPort.resolveActiveSubscriptionForAppointment(
      data.userId,
      startDateTime,
    );
    const subscriptionApplied = Boolean(activeSubscription);
    const subscriptionPlanId = activeSubscription?.planId ?? null;
    const subscriptionId = activeSubscription?.subscriptionId ?? null;
    let loyaltyProgramId: string | null = null;
    let loyaltyRewardApplied = false;
    if (!subscriptionApplied) {
      const loyaltyDecision = await this.commerceLoyaltyPolicyPort.resolveRewardDecision(data.userId, data.serviceId);
      loyaltyProgramId = loyaltyDecision?.programId ?? null;
      loyaltyRewardApplied = loyaltyDecision?.isFreeNext ?? false;
    }
    if (loyaltyRewardApplied || subscriptionApplied) {
      primaryServicePayable = 0;
    }
    let servicePrice = primaryServicePayable + additionalServicesPrice;
    const referralAttribution = subscriptionApplied
      ? null
      : await this.engagementReferralAttributionPort.resolveAttributionForBooking({
          referralAttributionId: data.referralAttributionId ?? null,
          userId: data.userId ?? null,
          guestContact: legacyGuestContact,
        });
    const productSelection = await this.resolveProductSelection(localId, requestedProducts, {
      allowInactive: isAdminActor,
      allowPrivate: isAdminActor,
      referenceDate: startDateTime,
    });
    let appliedCouponId: string | null = null;
    let couponDiscount = 0;
    if (data.appliedCouponId && !subscriptionApplied) {
      if (!data.userId) {
        throw new BadRequestException('Debes iniciar sesión para usar un cupón.');
      }
      if (loyaltyRewardApplied || subscriptionApplied) {
        throw new BadRequestException('No puedes aplicar un cupón en una cita gratis.');
      }
      const coupon = await this.commerceWalletLedgerPort.validateCoupon({
        userId: data.userId,
        couponId: data.appliedCouponId,
        serviceId: data.serviceId,
        referenceDate: startDateTime,
      });
      couponDiscount = this.commerceWalletLedgerPort.calculateCouponDiscount({
        couponType: coupon.discountType,
        couponValue: coupon.discountValue,
        baseServicePrice: primaryServicePayable,
      });
      appliedCouponId = coupon.id;
      primaryServicePayable = Math.max(0, primaryServicePayable - couponDiscount);
      servicePrice = primaryServicePayable + additionalServicesPrice;
    }

    const totalBeforeWallet = servicePrice + productSelection.total;
    let walletAppliedAmount = 0;
    if (data.useWallet && data.userId && !subscriptionApplied) {
      const available = await this.commerceWalletLedgerPort.getAvailableBalance(data.userId);
      walletAppliedAmount = Math.min(available, totalBeforeWallet);
    }
    const totalPrice = Math.max(0, totalBeforeWallet - walletAppliedAmount);
    const nextStatus = (data.status || 'scheduled') as AppointmentStatus;
    const shouldHoldStock = this.shouldHoldStock(nextStatus);
    const paymentContext = command.execution?.payment;
    const paymentStatus =
      (paymentContext?.status as PaymentStatus | undefined) ?? (totalPrice <= 0 ? PaymentStatus.exempt : PaymentStatus.in_person);
    const paymentAmount =
      typeof paymentContext?.amount === 'number' ? paymentContext.amount : totalPrice;
    const paymentCurrency = paymentContext?.currency || DEFAULT_CURRENCY;

    let appointment: AppointmentWithRelations;
    let queuedEmailDeliveryId: string | null = null;
    try {
      appointment = await this.prisma.$transaction(
        async (tx) => {
          await this.assertNoOverlappingAppointment(tx, {
            localId,
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
              totalDurationMinutes: targetDuration,
              loyaltyProgramId,
              loyaltyRewardApplied,
              subscriptionApplied,
              subscriptionPlanId,
              subscriptionId,
              referralAttributionId: shouldHoldStock ? referralAttribution?.id ?? null : null,
              appliedCouponId: shouldHoldStock ? appliedCouponId : null,
              walletAppliedAmount: new Prisma.Decimal(shouldHoldStock ? walletAppliedAmount : 0),
              startDateTime,
              price: new Prisma.Decimal(totalPrice),
              paymentMethod: (paymentContext?.method as any) ?? null,
              paymentStatus,
              paymentAmount: new Prisma.Decimal(paymentAmount),
              paymentCurrency,
              paymentExpiresAt: paymentContext?.expiresAt ?? null,
              stripePaymentIntentId: paymentContext?.stripePaymentIntentId ?? null,
              stripeCheckoutSessionId: paymentContext?.stripeCheckoutSessionId ?? null,
              status: nextStatus,
              notes: data.notes,
              guestName: data.guestName,
              guestContact: legacyGuestContact,
              guestEmail: structuredGuestContact.email,
              guestPhone: structuredGuestContact.phone,
              reminderSmsRequested: guestReminderConsent.sms,
              reminderWhatsappRequested: guestReminderConsent.whatsapp,
              earlierSlotRequested: data.notifyIfEarlierSlot === true,
              reminderSent: false,
              serviceItems: {
                create: serviceBundle.items.map((item) => ({
                  localId,
                  serviceId: item.serviceId,
                  position: item.position,
                  nameSnapshot: item.name,
                  durationMinutes: item.durationMinutes,
                  unitPrice: new Prisma.Decimal(
                    item.position === 0 ? primaryServicePayable : item.price,
                  ),
                })),
              },
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
            include: {
              user: true,
              barber: true,
              service: true,
              serviceItems: { orderBy: { position: 'asc' } },
              products: { include: { product: true } },
            },
          });

          if (shouldHoldStock && referralAttribution) {
            await this.engagementReferralAttributionPort.attachAttributionToAppointment({
              attributionId: referralAttribution.id,
              appointmentId: created.id,
              userId: data.userId ?? null,
              guestContact: legacyGuestContact,
              tx,
            });
          }

          if (shouldHoldStock && walletAppliedAmount > 0 && data.userId) {
            await this.commerceWalletLedgerPort.reserveWalletHold(
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
            await this.commerceWalletLedgerPort.reserveCouponUsage(
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

          if (!command.execution?.skipNotifications && paymentStatus !== PaymentStatus.pending) {
            const contact = this.getContact(
              created.user,
              created.guestName,
              created.guestContact,
              created.guestEmail,
              created.guestPhone,
            );
            const allowEmail = created.user ? created.user.notificationEmail !== false : true;
            if (allowEmail && this.notificationsService.enqueueAppointmentEmailInTransaction) {
              const queued = await this.notificationsService.enqueueAppointmentEmailInTransaction(
                contact,
                {
                  date: created.startDateTime,
                  serviceName: created.serviceNameSnapshot || created.service?.name,
                  barberName: created.barber?.name,
                },
                'creada',
                {
                  appointmentId: created.id,
                  idempotencyKey: `appointment:${created.id}:created`,
                  correlationId: command.context.correlationId,
                },
                tx,
              );
              queuedEmailDeliveryId = queued?.id ?? null;
            }
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
      await this.runStatusSideEffects(appointment.localId, appointment.id, nextStatus);
    }

    if (consentRequired) {
      await this.legalService.recordPrivacyConsent({
        bookingId: appointment.id,
        locationId: localId,
        consentGiven: true,
        ip: command.execution?.ip || null,
        userAgent: command.execution?.userAgent || null,
        actorUserId: command.execution?.actorUserId || null,
      });
    }

    if (queuedEmailDeliveryId) {
      void this.notificationsService.dispatchEmailDelivery(queuedEmailDeliveryId);
    } else if (!command.execution?.skipNotifications && paymentStatus !== PaymentStatus.pending) {
      await this.notifyAppointment(appointment, 'creada');
    }

    return mapAppointment(appointment);
  }

  updateAppointment(command: UpdateAppointmentCommand): Promise<unknown> {
    return this.updateAppointmentWithPrisma(command);
  }

  private async updateAppointmentWithPrisma(command: UpdateAppointmentCommand): Promise<unknown> {
    const localId = command.context.localId;
    const data = command.input;
    const current = await this.prisma.appointment.findFirst({
      where: { id: command.appointmentId, localId },
      include: {
        serviceItems: { orderBy: { position: 'asc' } },
        products: { include: { product: true } },
      },
    });
    if (!current) throw new NotFoundException('Appointment not found');

    const transitionError = getInvalidStatusTransitionMessage(
      current.status as BookingStatus,
      data.status as BookingStatus | undefined,
    );
    if (transitionError) {
      throw new BadRequestException(transitionError);
    }

    const nextServiceId = data.serviceId ?? current.serviceId;
    const currentServiceIds = current.serviceItems.length > 0
      ? current.serviceItems.map((item) => item.serviceId)
      : [current.serviceId];
    const nextServiceIds = data.serviceId !== undefined ? [nextServiceId] : currentServiceIds;
    const nextBarberId = data.barberId ?? current.barberId;
    const nextUserId = data.userId === undefined ? current.userId : data.userId;
    const nextStartDateTime = data.startDateTime ? new Date(data.startDateTime) : current.startDateTime;
    if (data.status === 'completed') {
      const duration = data.serviceId !== undefined
        ? await this.getServiceDuration(localId, nextServiceId)
        : current.totalDurationMinutes;
      const completionTimingError = getCompletionTimingViolationMessage({
        nextStatus: data.status as BookingStatus,
        now: new Date(),
        nextStartDateTime,
        durationMinutes: duration,
        confirmationGraceMs: CONFIRMATION_GRACE_MS,
      });
      if (completionTimingError) {
        throw new BadRequestException(completionTimingError);
      }
    }

    const nextStatus = (data.status ?? current.status) as AppointmentStatus;
    const guestContactInputProvided =
      data.guestContact !== undefined || data.guestEmail !== undefined || data.guestPhone !== undefined;
    const nextStructuredGuestContact = parseGuestContact({
      guestContact: data.guestContact === undefined ? current.guestContact : data.guestContact,
      guestEmail: data.guestEmail === undefined ? current.guestEmail : data.guestEmail,
      guestPhone: data.guestPhone === undefined ? current.guestPhone : data.guestPhone,
    });
    const nextLegacyGuestContact = guestContactInputProvided
      ? buildLegacyGuestContact(nextStructuredGuestContact)
      : undefined;
    const startChanged =
      data.startDateTime && new Date(data.startDateTime).getTime() !== current.startDateTime.getTime();
    const serviceChanged = data.serviceId !== undefined && data.serviceId !== current.serviceId;
    const barberChanged = data.barberId !== undefined && data.barberId !== current.barberId;
    const userChanged = data.userId !== undefined && data.userId !== current.userId;
    const settings = await this.settingsService.getSettings();
    const slotIntervalMinutes = this.resolveSlotIntervalMinutes(
      settings.appointments?.slotIntervalMinutes,
    );
    const nextServiceBundle = await this.resolveServiceBundle(localId, nextServiceIds, nextStartDateTime);

    if (startChanged || serviceChanged || barberChanged) {
      await this.assertBarberServicesCompatibility(localId, nextBarberId, nextServiceIds);
      await this.assertSlotAvailable({
        context: command.context,
        barberId: data.barberId || current.barberId,
        serviceId: data.serviceId || current.serviceId,
        serviceIds: nextServiceIds,
        startDateTime: data.startDateTime || current.startDateTime.toISOString(),
        appointmentIdToIgnore: current.id,
        slotIntervalMinutes,
      });
    }

    const statusChanged = nextStatus !== current.status;
    const isCancelled = statusChanged && nextStatus === 'cancelled';
    const productsInputProvided = Array.isArray(data.products);

    const isAdminActor = Boolean(command.execution?.actorUserId);

    const cutoffHours = settings.appointments?.cancellationCutoffHours ?? 0;
    const cancellationCutoffError = getCancellationCutoffViolationMessage({
      isCancelled,
      isAdminActor,
      cutoffHours,
      nowMs: Date.now(),
      nextStartDateTimeMs: nextStartDateTime.getTime(),
    });
    if (cancellationCutoffError) {
      throw new BadRequestException(cancellationCutoffError);
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

    const shouldRecalculatePricingSignals =
      data.serviceId !== undefined || data.startDateTime !== undefined || userChanged;
    let subscriptionApplied = current.subscriptionApplied ?? false;
    let subscriptionPlanId = current.subscriptionPlanId ?? null;
    let subscriptionId = current.subscriptionId ?? null;
    if (shouldRecalculatePricingSignals) {
      const activeSubscription = await this.commerceSubscriptionPolicyPort.resolveActiveSubscriptionForAppointment(
        nextUserId,
        nextStartDateTime,
      );
      subscriptionApplied = Boolean(activeSubscription);
      subscriptionPlanId = activeSubscription?.planId ?? null;
      subscriptionId = activeSubscription?.subscriptionId ?? null;
    }

    let loyaltyProgramId = current.loyaltyProgramId ?? null;
    let loyaltyRewardApplied = current.loyaltyRewardApplied ?? false;
    if (shouldRecalculatePricingSignals) {
      if (subscriptionApplied) {
        loyaltyProgramId = null;
        loyaltyRewardApplied = false;
      } else {
        const loyaltyDecision = await this.commerceLoyaltyPolicyPort.resolveRewardDecision(nextUserId, nextServiceId);
        loyaltyProgramId = loyaltyDecision?.programId ?? null;
        loyaltyRewardApplied = loyaltyDecision?.isFreeNext ?? false;
      }
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
      ? await this.resolveProductSelection(localId, data.products ?? [], {
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

    const adminPermissionError = getAdminPermissionViolationMessage({
      isAdminActor,
      isPriceModified: data.price !== undefined,
      isPaymentMethodModified: data.paymentMethod !== undefined,
      hasRewardFieldsModified:
        data.referralAttributionId !== undefined ||
        data.appliedCouponId !== undefined ||
        data.walletAppliedAmount !== undefined,
    });
    if (adminPermissionError) {
      throw new ForbiddenException(adminPermissionError);
    }

    let price: Prisma.Decimal | undefined;
    let resolvedServiceName: string | null = null;
    let resolvedServicePrice: number | null = null;
    if (shouldRecalculatePricingSignals) {
      resolvedServiceName = nextServiceBundle.name;
      const primaryPrice = nextServiceBundle.items[0]?.price ?? 0;
      resolvedServicePrice = subscriptionApplied || loyaltyRewardApplied
        ? Math.max(0, nextServiceBundle.price - primaryPrice)
        : nextServiceBundle.price;
    }

    if (data.price !== undefined) {
      price = new Prisma.Decimal(data.price);
    } else if (shouldRecalculatePricingSignals || productsInputProvided) {
      const baseServicePrice = shouldRecalculatePricingSignals
        ? resolvedServicePrice ?? 0
        : Math.max(0, Number(current.price) - currentProductsTotal);
      const walletAmount = subscriptionApplied
        ? 0
        : data.walletAppliedAmount === undefined
          ? Number(current.walletAppliedAmount ?? 0)
          : data.walletAppliedAmount;
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
      snapshotUpdates.serviceNameSnapshot = resolvedServiceName || nextServiceBundle.name;
    }
    if (barberChanged || !current.barberNameSnapshot) {
      snapshotUpdates.barberNameSnapshot = await this.getBarberNameSnapshot(localId, nextBarberId);
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
    const nextDuration = nextServiceBundle.durationMinutes;

    const shouldNotify = serviceChanged || barberChanged || startChanged || isCancelled;
    const notificationAction = isCancelled ? 'cancelada' : 'actualizada';
    let queuedEmailDeliveryId: string | null = null;
    let updated: AppointmentWithRelations | any;
    try {
      updated = await this.prisma.$transaction(
        async (tx) => {
          if (startChanged || serviceChanged || barberChanged) {
            await this.assertNoOverlappingAppointment(tx, {
              localId,
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

          const persisted = await tx.appointment.update({
            where: { id: command.appointmentId },
            data: {
              userId: data.userId,
              barberId: data.barberId,
              serviceId: data.serviceId,
              ...snapshotUpdates,
              totalDurationMinutes: nextDuration,
              loyaltyProgramId,
              loyaltyRewardApplied,
              subscriptionApplied,
              subscriptionPlanId,
              subscriptionId,
              referralAttributionId: subscriptionApplied
                ? null
                : data.referralAttributionId === undefined
                  ? undefined
                  : data.referralAttributionId,
              appliedCouponId: subscriptionApplied
                ? null
                : data.appliedCouponId === undefined
                  ? undefined
                  : data.appliedCouponId,
              walletAppliedAmount:
                subscriptionApplied
                  ? new Prisma.Decimal(0)
                  : data.walletAppliedAmount === undefined
                    ? undefined
                    : new Prisma.Decimal(data.walletAppliedAmount),
              startDateTime: data.startDateTime ? new Date(data.startDateTime) : undefined,
              price,
              paymentMethod: data.paymentMethod === undefined ? undefined : (data.paymentMethod as any),
              status: data.status as any,
              notes: data.notes,
              guestName: data.guestName,
              guestContact: nextLegacyGuestContact,
              guestEmail: guestContactInputProvided ? nextStructuredGuestContact.email : undefined,
              guestPhone: guestContactInputProvided ? nextStructuredGuestContact.phone : undefined,
              earlierSlotRequested:
                nextStatus === 'scheduled' ? undefined : false,
              earlierSlotNotifiedAt: startChanged ? null : undefined,
              earlierSlotCandidateAt: startChanged ? null : undefined,
              reminderSent,
              serviceItems: serviceChanged || current.serviceItems.length === 0
                ? {
                    deleteMany: {},
                    create: nextServiceBundle.items.map((item) => ({
                      localId,
                      serviceId: item.serviceId,
                      position: item.position,
                      nameSnapshot: item.name,
                      durationMinutes: item.durationMinutes,
                      unitPrice: new Prisma.Decimal(item.price),
                    })),
                  }
                : undefined,
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
            include: {
              user: true,
              barber: true,
              service: true,
              serviceItems: { orderBy: { position: 'asc' } },
              products: { include: { product: true } },
            },
          });

          if (shouldNotify) {
            const contact = this.getContact(
              persisted.user,
              persisted.guestName,
              persisted.guestContact,
              persisted.guestEmail,
              persisted.guestPhone,
            );
            const allowEmail = persisted.user ? persisted.user.notificationEmail !== false : true;
            if (allowEmail && this.notificationsService.enqueueAppointmentEmailInTransaction) {
              const queued = await this.notificationsService.enqueueAppointmentEmailInTransaction(
                contact,
                {
                  date: persisted.startDateTime,
                  serviceName: persisted.serviceNameSnapshot || persisted.service?.name,
                  barberName: persisted.barber?.name,
                },
                notificationAction,
                {
                  appointmentId: persisted.id,
                  idempotencyKey: `appointment:${persisted.id}:${notificationAction}:${persisted.updatedAt.toISOString()}`,
                  correlationId: command.context.correlationId,
                },
                tx,
              );
              queuedEmailDeliveryId = queued?.id ?? null;
            }
          }

          return persisted;
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
      await this.runStatusSideEffects(localId, updated.id, nextStatus);
    }

    if (queuedEmailDeliveryId) {
      void this.notificationsService.dispatchEmailDelivery(queuedEmailDeliveryId);
    } else if (shouldNotify) {
      await this.notifyAppointment(updated, notificationAction);
    }

    const releasedAvailability =
      (current.status === 'scheduled' && (nextStatus === 'cancelled' || nextStatus === 'no_show')) ||
      startChanged ||
      barberChanged;
    if (releasedAvailability) {
      await this.notifyEarlierSlotOpportunity({
        context: command.context,
        appointmentId: current.id,
        barberId: current.barberId,
        startDateTime: current.startDateTime,
      });
    }

    return mapAppointment(updated);
  }

  removeAppointment(command: RemoveAppointmentCommand): Promise<unknown> {
    return this.removeAppointmentWithPrisma(command);
  }

  private async removeAppointmentWithPrisma(command: RemoveAppointmentCommand): Promise<unknown> {
    const localId = command.context.localId;
    const existing = await this.prisma.appointment.findFirst({
      where: { id: command.appointmentId, localId },
      include: { products: true },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    const sideEffects = await this.runAppointmentStatusSideEffectsUseCase.execute({
      localId,
      appointmentId: existing.id,
      nextStatus: 'cancelled' as BookingStatusSideEffectsStatus,
    });
    sideEffects.failures.forEach((failure) => {
      this.logger.error(
        `Post-status side effect failed (${failure.effect}) for appointment ${existing.id}: ${failure.message}`,
      );
    });

    await this.prisma.$transaction(async (tx) => {
      if (this.shouldHoldStock(existing.status) && existing.products.length > 0) {
        for (const item of existing.products) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      await tx.appointment.delete({ where: { id: command.appointmentId } });
    });

    await this.auditLogs.log({
      locationId: localId,
      action: 'appointment.deleted',
      entityType: 'appointment',
      entityId: command.appointmentId,
      metadata: { status: existing.status },
    });
    if (existing.status === 'scheduled') {
      await this.notifyEarlierSlotOpportunity({
        context: command.context,
        appointmentId: existing.id,
        barberId: existing.barberId,
        startDateTime: existing.startDateTime,
      });
    }
    return { success: true };
  }
}
