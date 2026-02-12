import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionDurationUnit,
  UserSubscriptionSource,
  UserSubscriptionStatus,
} from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';
import { AssignUserSubscriptionDto } from './dto/assign-user-subscription.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { MarkSubscriptionPaidDto } from './dto/mark-subscription-paid.dto';
import { SubscribePlanDto, SubscriptionCheckoutMode } from './dto/subscribe-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

type SubscriptionPlanRecord = Prisma.SubscriptionPlanGetPayload<Record<string, never>>;
type UserSubscriptionWithPlan = Prisma.UserSubscriptionGetPayload<{
  include: { plan: true };
}>;

const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const SUBSCRIPTION_BOOKING_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.paid,
  PaymentStatus.in_person,
  PaymentStatus.exempt,
];

@Injectable()
export class SubscriptionsService {
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  private getStripeClient() {
    if (this.stripeClient) return this.stripeClient;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new InternalServerErrorException('Stripe no está configurado.');
    }
    this.stripeClient = new Stripe(secret, { apiVersion: '2023-10-16' });
    return this.stripeClient;
  }

  private async isEnabled() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return true;
    return !hidden.includes('subscriptions');
  }

  private async assertEnabled() {
    if (!(await this.isEnabled())) {
      throw new BadRequestException('Las suscripciones no están habilitadas en este local.');
    }
  }

  private async getStripeAccountIdForSubscriptionCheckout() {
    const brandId = getCurrentBrandId();
    const localId = getCurrentLocalId();
    const [brandConfig, locationConfig] = await Promise.all([
      this.tenantConfig.getBrandConfig(brandId),
      this.tenantConfig.getLocationConfig(localId),
    ]);
    const brandStripe = (brandConfig.payments?.stripe || {}) as Record<string, unknown>;
    const locationStripe = (locationConfig.payments?.stripe || {}) as Record<string, unknown>;
    const mode = brandStripe.mode === 'brand' ? 'brand' : 'location';
    const brandEnabled = brandStripe.enabled === true;
    const platformEnabled = locationStripe.platformEnabled !== false;
    const localEnabled = locationStripe.enabled === true;

    if (!brandEnabled) {
      throw new BadRequestException('Stripe no está habilitado por la marca.');
    }
    if (!platformEnabled) {
      throw new BadRequestException('Stripe no está habilitado para este local.');
    }
    if (!localEnabled) {
      throw new BadRequestException('Stripe está desactivado en este local.');
    }

    const accountId =
      mode === 'brand'
        ? (brandStripe.accountId as string | undefined)
        : (locationStripe.accountId as string | undefined);
    if (!accountId) {
      throw new BadRequestException('Stripe no está conectado en este local.');
    }

    const stripe = this.getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    if (!account.charges_enabled || !account.details_submitted) {
      throw new BadRequestException('La cuenta Stripe del local aún no está lista para cobrar.');
    }
    return { accountId, mode };
  }

  private async createStripeCheckoutForSubscription(params: {
    subscriptionId: string;
    userId: string;
    planName: string;
    amount: number;
    userEmail: string;
    baseUrl: string;
  }) {
    const stripe = this.getStripeClient();
    const { accountId } = await this.getStripeAccountIdForSubscriptionCheckout();
    const unitAmount = Math.max(0, Math.round(params.amount * 100));
    if (unitAmount <= 0) {
      throw new BadRequestException('El importe de la suscripción es inválido.');
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: DEFAULT_CURRENCY,
              unit_amount: unitAmount,
              product_data: {
                name: `Suscripción · ${params.planName}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: params.userEmail || undefined,
        client_reference_id: params.subscriptionId,
        metadata: {
          subscriptionId: params.subscriptionId,
          userId: params.userId,
          localId: getCurrentLocalId(),
          brandId: getCurrentBrandId(),
        },
        success_url: `${params.baseUrl}/app/subscriptions?subscriptionPayment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${params.baseUrl}/app/subscriptions?subscriptionPayment=cancel&session_id={CHECKOUT_SESSION_ID}`,
      },
      { stripeAccount: accountId },
    );

    await this.prisma.userSubscription.update({
      where: { id: params.subscriptionId },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : null,
      },
    });

    if (!session.url) {
      throw new BadRequestException('No se pudo iniciar el pago de la suscripción.');
    }

    return session.url;
  }

  private mapPlan(plan: SubscriptionPlanRecord) {
    return {
      id: plan.id,
      localId: plan.localId,
      name: plan.name,
      description: plan.description ?? null,
      price: Number(plan.price),
      durationValue: plan.durationValue,
      durationUnit: plan.durationUnit,
      isActive: plan.isActive,
      isArchived: plan.isArchived,
      availabilityStartDate: plan.availabilityStartDate ? plan.availabilityStartDate.toISOString() : null,
      availabilityEndDate: plan.availabilityEndDate ? plan.availabilityEndDate.toISOString() : null,
      displayOrder: plan.displayOrder,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private toUtcDayStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private toUtcDayEnd(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  }

  private mapUserSubscription(subscription: UserSubscriptionWithPlan, referenceDate = new Date()) {
    const referenceTimestamp = referenceDate.getTime();
    const startBoundary = this.toUtcDayStart(subscription.startDate).getTime();
    const endBoundary = this.toUtcDayEnd(subscription.endDate).getTime();
    const isActiveOnReferenceDay =
      referenceTimestamp >= startBoundary && referenceTimestamp <= endBoundary;
    const normalizedStatus =
      subscription.status === UserSubscriptionStatus.active &&
      endBoundary < referenceTimestamp
        ? UserSubscriptionStatus.expired
        : subscription.status;
    const isPaymentEligibleForBooking = SUBSCRIPTION_BOOKING_PAYMENT_STATUSES.includes(
      subscription.paymentStatus,
    );

    return {
      id: subscription.id,
      localId: subscription.localId,
      userId: subscription.userId,
      planId: subscription.planId,
      status: normalizedStatus,
      source: subscription.source,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate.toISOString(),
      paymentStatus: subscription.paymentStatus,
      paymentMethod: subscription.paymentMethod ?? null,
      paymentAmount: subscription.paymentAmount ? Number(subscription.paymentAmount) : null,
      paymentCurrency: subscription.paymentCurrency ?? null,
      paymentPaidAt: subscription.paymentPaidAt ? subscription.paymentPaidAt.toISOString() : null,
      stripePaymentIntentId: subscription.stripePaymentIntentId ?? null,
      stripeCheckoutSessionId: subscription.stripeCheckoutSessionId ?? null,
      cancelledAt: subscription.cancelledAt ? subscription.cancelledAt.toISOString() : null,
      notes: subscription.notes ?? null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      plan: this.mapPlan(subscription.plan),
      isActiveNow:
        normalizedStatus === UserSubscriptionStatus.active &&
        isActiveOnReferenceDay,
      isUsableNow:
        normalizedStatus === UserSubscriptionStatus.active &&
        isActiveOnReferenceDay &&
        isPaymentEligibleForBooking,
      isPaymentSettled: subscription.paymentStatus === PaymentStatus.paid,
    };
  }

  private parseDateOrThrow(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} no es una fecha válida.`);
    }
    return parsed;
  }

  private parsePlanAvailabilityDate(
    value: string | null | undefined,
    field: string,
    boundary: 'start' | 'end',
  ) {
    if (!value) return null;
    const normalizedValue =
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
        : value;
    return this.parseDateOrThrow(normalizedValue, field);
  }

  private assertPlanAvailabilityRange(
    availabilityStartDate: Date | null,
    availabilityEndDate: Date | null,
  ) {
    if (!availabilityStartDate || !availabilityEndDate) return;
    if (availabilityEndDate.getTime() < availabilityStartDate.getTime()) {
      throw new BadRequestException(
        'La fecha de fin de disponibilidad no puede ser anterior a la fecha de inicio.',
      );
    }
  }

  private isPlanAvailableForSelfSubscription(
    plan: Pick<SubscriptionPlanRecord, 'isActive' | 'availabilityStartDate' | 'availabilityEndDate'>,
    referenceDate = new Date(),
  ) {
    if (!plan.isActive) return false;
    if (plan.availabilityStartDate && plan.availabilityStartDate.getTime() > referenceDate.getTime()) return false;
    if (plan.availabilityEndDate && plan.availabilityEndDate.getTime() < referenceDate.getTime()) return false;
    return true;
  }

  private calculateEndDate(
    startDate: Date,
    durationValue: number,
    durationUnit: SubscriptionDurationUnit,
  ) {
    const endDate = new Date(startDate.getTime());
    switch (durationUnit) {
      case SubscriptionDurationUnit.days:
        endDate.setUTCDate(endDate.getUTCDate() + durationValue);
        break;
      case SubscriptionDurationUnit.weeks:
        endDate.setUTCDate(endDate.getUTCDate() + durationValue * 7);
        break;
      case SubscriptionDurationUnit.months:
        endDate.setUTCMonth(endDate.getUTCMonth() + durationValue);
        break;
      default:
        throw new BadRequestException('Unidad de duración no válida.');
    }
    return endDate;
  }

  private async syncExpiredSubscriptions(localId: string, now = new Date(), userId?: string) {
    const cutoff = this.toUtcDayStart(now);
    await this.prisma.userSubscription.updateMany({
      where: {
        localId,
        status: UserSubscriptionStatus.active,
        endDate: { lt: cutoff },
        ...(userId ? { userId } : {}),
      },
      data: {
        status: UserSubscriptionStatus.expired,
      },
    });
  }

  private async getPlanOrThrow(
    planId: string,
    options?: { requireActive?: boolean; requireSelfSubscriptionAvailabilityAt?: Date },
  ) {
    const localId = getCurrentLocalId();
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        localId,
        isArchived: false,
      },
    });
    if (!plan) {
      throw new NotFoundException('Plan de suscripción no encontrado.');
    }
    if (options?.requireActive && !plan.isActive) {
      throw new BadRequestException('Este plan está desactivado.');
    }
    if (
      options?.requireSelfSubscriptionAvailabilityAt &&
      !this.isPlanAvailableForSelfSubscription(plan, options.requireSelfSubscriptionAvailabilityAt)
    ) {
      throw new BadRequestException('Este plan no está disponible para nuevas suscripciones en este momento.');
    }
    return plan;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    return user;
  }

  async listPlansAdmin(includeArchived = false) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        localId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return plans.map((plan) => this.mapPlan(plan));
  }

  async listActivePlans() {
    if (!(await this.isEnabled())) return [];
    const localId = getCurrentLocalId();
    const now = new Date();
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        localId,
        isArchived: false,
        isActive: true,
        AND: [
          { OR: [{ availabilityStartDate: null }, { availabilityStartDate: { lte: now } }] },
          { OR: [{ availabilityEndDate: null }, { availabilityEndDate: { gte: now } }] },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return plans.map((plan) => this.mapPlan(plan));
  }

  async createPlan(data: CreateSubscriptionPlanDto) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    const availabilityStartDate = this.parsePlanAvailabilityDate(
      data.availabilityStartDate,
      'availabilityStartDate',
      'start',
    );
    const availabilityEndDate = this.parsePlanAvailabilityDate(
      data.availabilityEndDate,
      'availabilityEndDate',
      'end',
    );
    this.assertPlanAvailabilityRange(availabilityStartDate, availabilityEndDate);
    const created = await this.prisma.subscriptionPlan.create({
      data: {
        localId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        price: new Prisma.Decimal(data.price),
        durationValue: data.durationValue,
        durationUnit: data.durationUnit,
        isActive: data.isActive ?? true,
        availabilityStartDate,
        availabilityEndDate,
        displayOrder: data.displayOrder ?? 0,
      },
    });
    return this.mapPlan(created);
  }

  async updatePlan(id: string, data: UpdateSubscriptionPlanDto) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: { id, localId },
    });
    if (!existing) {
      throw new NotFoundException('Plan de suscripción no encontrado.');
    }
    const availabilityStartDate =
      data.availabilityStartDate === undefined
        ? existing.availabilityStartDate
        : this.parsePlanAvailabilityDate(data.availabilityStartDate, 'availabilityStartDate', 'start');
    const availabilityEndDate =
      data.availabilityEndDate === undefined
        ? existing.availabilityEndDate
        : this.parsePlanAvailabilityDate(data.availabilityEndDate, 'availabilityEndDate', 'end');
    this.assertPlanAvailabilityRange(availabilityStartDate, availabilityEndDate);
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        description: data.description === undefined ? undefined : data.description?.trim() || null,
        price: data.price === undefined ? undefined : new Prisma.Decimal(data.price),
        durationValue: data.durationValue,
        durationUnit: data.durationUnit,
        isActive: data.isActive,
        availabilityStartDate:
          data.availabilityStartDate === undefined ? undefined : availabilityStartDate,
        availabilityEndDate: data.availabilityEndDate === undefined ? undefined : availabilityEndDate,
        displayOrder: data.displayOrder,
      },
    });
    return this.mapPlan(updated);
  }

  async archivePlan(id: string) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: { id, localId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Plan de suscripción no encontrado.');
    }
    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isArchived: true, isActive: false },
    });
    return { success: true };
  }

  async listUserSubscriptions(userId: string) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    await this.ensureUserExists(userId);
    await this.syncExpiredSubscriptions(localId, new Date(), userId);
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: { localId, userId },
      include: { plan: true },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return subscriptions.map((subscription) => this.mapUserSubscription(subscription));
  }

  async listUserSubscriptionsPage(userId: string, params: { page: number; pageSize: number }) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    await this.ensureUserExists(userId);
    await this.syncExpiredSubscriptions(localId, new Date(), userId);

    const [total, subscriptions] = await this.prisma.$transaction([
      this.prisma.userSubscription.count({
        where: { localId, userId },
      }),
      this.prisma.userSubscription.findMany({
        where: { localId, userId },
        include: { plan: true },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
      items: subscriptions.map((subscription) => this.mapUserSubscription(subscription)),
    };
  }

  async getUserActiveSubscription(userId: string, referenceDateInput?: string) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    await this.ensureUserExists(userId);
    const referenceDate = referenceDateInput
      ? this.parseDateOrThrow(referenceDateInput, 'referenceDate')
      : new Date();
    const referenceDayStart = this.toUtcDayStart(referenceDate);
    const referenceDayEnd = this.toUtcDayEnd(referenceDate);
    await this.syncExpiredSubscriptions(localId, referenceDate, userId);
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        localId,
        userId,
        status: UserSubscriptionStatus.active,
        startDate: { lte: referenceDayEnd },
        endDate: { gte: referenceDayStart },
      },
      include: { plan: true },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    });
    return subscription ? this.mapUserSubscription(subscription, referenceDate) : null;
  }

  private async createUserSubscription(
    userId: string,
    source: UserSubscriptionSource,
    data: AssignUserSubscriptionDto | SubscribePlanDto,
    options?: {
      requireSelfSubscriptionAvailability?: boolean;
      enforceSingleActivePlan?: boolean;
      paymentMode?: SubscriptionCheckoutMode;
    },
  ) {
    const localId = getCurrentLocalId();
    const user = await this.ensureUserExists(userId);
    const startDate =
      'startDate' in data && data.startDate
        ? this.parseDateOrThrow(data.startDate, 'startDate')
        : new Date();
    const plan = await this.getPlanOrThrow(data.planId, {
      requireActive: true,
      requireSelfSubscriptionAvailabilityAt: options?.requireSelfSubscriptionAvailability ? startDate : undefined,
    });
    await this.syncExpiredSubscriptions(localId, startDate, userId);
    const alreadyActive = await this.prisma.userSubscription.findFirst({
      where: {
        localId,
        userId,
        planId: plan.id,
        status: UserSubscriptionStatus.active,
        startDate: { lte: startDate },
        endDate: { gte: startDate },
      },
      include: { plan: true },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (alreadyActive) {
      return {
        user,
        subscription: this.mapUserSubscription(alreadyActive, startDate),
      };
    }

    if (options?.enforceSingleActivePlan) {
      const activeSubscription = await this.prisma.userSubscription.findFirst({
        where: {
          localId,
          userId,
          status: UserSubscriptionStatus.active,
          startDate: { lte: startDate },
          endDate: { gte: startDate },
        },
        include: { plan: true },
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      });
      if (activeSubscription) {
        throw new BadRequestException(
          `Ya tienes una suscripción activa (${activeSubscription.plan.name}). Debes esperar a que termine para suscribirte a otro plan.`,
        );
      }
    }

    const paymentMode = options?.paymentMode ?? SubscriptionCheckoutMode.next_appointment;
    const paymentStatus =
      source === UserSubscriptionSource.client
        ? paymentMode === SubscriptionCheckoutMode.stripe
          ? PaymentStatus.pending
          : PaymentStatus.in_person
        : PaymentStatus.paid;
    const paymentMethod =
      source === UserSubscriptionSource.client && paymentMode === SubscriptionCheckoutMode.stripe
        ? PaymentMethod.stripe
        : null;
    const paymentPaidAt = paymentStatus === PaymentStatus.paid ? startDate : null;

    const endDate = this.calculateEndDate(startDate, plan.durationValue, plan.durationUnit);
    const created = await this.prisma.userSubscription.create({
      data: {
        localId,
        userId,
        planId: plan.id,
        source,
        status: UserSubscriptionStatus.active,
        startDate,
        endDate,
        paymentStatus,
        paymentMethod,
        paymentAmount: new Prisma.Decimal(plan.price),
        paymentCurrency: DEFAULT_CURRENCY,
        paymentPaidAt,
        notes: 'notes' in data ? data.notes?.trim() || null : null,
      },
      include: { plan: true },
    });
    return {
      user,
      subscription: this.mapUserSubscription(created, startDate),
    };
  }

  async assignUserSubscription(userId: string, data: AssignUserSubscriptionDto) {
    await this.assertEnabled();
    const created = await this.createUserSubscription(userId, UserSubscriptionSource.admin, data, {
      enforceSingleActivePlan: true,
    });
    return created.subscription;
  }

  async subscribeCurrentUser(userId: string, data: SubscribePlanDto, baseUrl: string) {
    await this.assertEnabled();
    const paymentMode = data.paymentMode ?? SubscriptionCheckoutMode.next_appointment;
    const created = await this.createUserSubscription(userId, UserSubscriptionSource.client, data, {
      requireSelfSubscriptionAvailability: true,
      enforceSingleActivePlan: true,
      paymentMode,
    });
    if (paymentMode === SubscriptionCheckoutMode.stripe) {
      let checkoutUrl: string;
      try {
        checkoutUrl = await this.createStripeCheckoutForSubscription({
          subscriptionId: created.subscription.id,
          userId,
          planName: created.subscription.plan.name,
          amount: created.subscription.paymentAmount ?? created.subscription.plan.price,
          userEmail: created.user.email,
          baseUrl,
        });
      } catch (error) {
        await this.prisma.userSubscription.update({
          where: { id: created.subscription.id },
          data: {
            status: UserSubscriptionStatus.cancelled,
            cancelledAt: new Date(),
            paymentStatus: PaymentStatus.cancelled,
          },
        });
        throw error;
      }
      const refreshed = await this.prisma.userSubscription.findUnique({
        where: { id: created.subscription.id },
        include: { plan: true },
      });
      if (!refreshed) {
        throw new NotFoundException('Suscripción no encontrada tras crear checkout.');
      }
      return {
        mode: 'stripe' as const,
        checkoutUrl,
        subscription: this.mapUserSubscription(refreshed),
      };
    }
    return {
      mode: 'next_appointment' as const,
      checkoutUrl: null,
      subscription: created.subscription,
    };
  }

  async markSubscriptionPaid(userId: string, subscriptionId: string, data: MarkSubscriptionPaidDto) {
    await this.assertEnabled();
    const localId = getCurrentLocalId();
    await this.ensureUserExists(userId);
    const existing = await this.prisma.userSubscription.findFirst({
      where: { id: subscriptionId, localId, userId },
      include: { plan: true },
    });
    if (!existing) {
      throw new NotFoundException('Suscripción no encontrada.');
    }
    const paidAt = data.paidAt ? this.parseDateOrThrow(data.paidAt, 'paidAt') : new Date();
    const updated = await this.prisma.userSubscription.update({
      where: { id: subscriptionId },
      data: {
        paymentStatus: PaymentStatus.paid,
        paymentMethod: data.paymentMethod ?? existing.paymentMethod,
        paymentAmount: existing.paymentAmount ?? existing.plan.price,
        paymentCurrency: existing.paymentCurrency ?? DEFAULT_CURRENCY,
        paymentPaidAt: paidAt,
      },
      include: { plan: true },
    });
    return this.mapUserSubscription(updated, paidAt);
  }

  async settlePendingInPersonPaymentFromAppointment(params: {
    subscriptionId: string | null | undefined;
    paymentMethod: PaymentMethod | null | undefined;
    completedAt?: Date;
  }) {
    if (!params.subscriptionId) return null;
    const localId = getCurrentLocalId();
    const existing = await this.prisma.userSubscription.findFirst({
      where: { id: params.subscriptionId, localId },
      include: { plan: true },
    });
    if (!existing) return null;
    if (existing.paymentStatus !== PaymentStatus.in_person) return null;
    const paidAt = params.completedAt ?? new Date();
    const updated = await this.prisma.userSubscription.update({
      where: { id: existing.id },
      data: {
        paymentStatus: PaymentStatus.paid,
        paymentMethod: params.paymentMethod ?? existing.paymentMethod,
        paymentAmount: existing.paymentAmount ?? existing.plan.price,
        paymentCurrency: existing.paymentCurrency ?? DEFAULT_CURRENCY,
        paymentPaidAt: paidAt,
      },
      include: { plan: true },
    });
    return this.mapUserSubscription(updated, paidAt);
  }

  async hasUsableActiveSubscription(userId: string | null | undefined, referenceDate = new Date()) {
    const active = await this.resolveActiveSubscriptionForAppointment(userId, referenceDate);
    return Boolean(active);
  }

  async resolveActiveSubscriptionForAppointment(
    userId: string | null | undefined,
    appointmentDate: Date,
  ) {
    if (!userId) return null;
    if (!(await this.isEnabled())) return null;
    const localId = getCurrentLocalId();
    const appointmentDayStart = this.toUtcDayStart(appointmentDate);
    const appointmentDayEnd = this.toUtcDayEnd(appointmentDate);
    await this.syncExpiredSubscriptions(localId, appointmentDate, userId);
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        localId,
        userId,
        status: UserSubscriptionStatus.active,
        paymentStatus: { in: SUBSCRIPTION_BOOKING_PAYMENT_STATUSES },
        startDate: { lte: appointmentDayEnd },
        endDate: { gte: appointmentDayStart },
      },
      include: { plan: true },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (!subscription) {
      return null;
    }
    return {
      subscriptionId: subscription.id,
      planId: subscription.planId,
      planName: subscription.plan.name,
      paymentStatus: subscription.paymentStatus,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    };
  }
}
