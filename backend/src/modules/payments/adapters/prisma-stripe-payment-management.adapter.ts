import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { ProcessStripeWebhookUseCase } from '../../../contexts/commerce/application/use-cases/process-stripe-webhook.use-case';
import {
  COMMERCE_PAYMENT_LIFECYCLE_PORT,
  CommercePaymentLifecyclePort,
} from '../../../contexts/commerce/ports/outbound/payment-lifecycle.port';
import {
  CommerceOnlinePaymentAvailability,
  CommerceOnlinePaymentWebhookEvent,
  CommercePaymentManagementPort,
} from '../../../contexts/commerce/ports/outbound/payment-management.port';
import {
  COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT,
  CommerceStripePaymentGatewayPort,
} from '../../../contexts/commerce/ports/outbound/stripe-payment-gateway.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';
import { AppointmentsFacade } from '../../appointments/appointments.facade';

type StripeAccountStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

type StripeConfigSnapshot = {
  mode: 'brand' | 'location';
  brandEnabled: boolean;
  platformEnabled: boolean;
  localEnabled: boolean;
  brandAccountId?: string;
  localAccountId?: string;
};

const parseGuestContact = (contact?: string | null) => {
  if (!contact) return { email: null, phone: null };
  const parts = contact.split('·').map((part) => part.trim()).filter(Boolean);
  let email: string | null = null;
  let phone: string | null = null;
  parts.forEach((part) => {
    if (part.includes('@')) {
      email = email || part;
    } else {
      phone = phone || part;
    }
  });
  return { email, phone };
};

@Injectable()
export class PrismaStripePaymentManagementAdapter implements CommercePaymentManagementPort {
  private readonly processStripeWebhookUseCase: ProcessStripeWebhookUseCase;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly appointmentsFacade: AppointmentsFacade,
    @Inject(COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT)
    private readonly stripeGateway: CommerceStripePaymentGatewayPort,
    @Inject(COMMERCE_PAYMENT_LIFECYCLE_PORT)
    private readonly paymentLifecyclePort: CommercePaymentLifecyclePort,
  ) {
    this.processStripeWebhookUseCase = new ProcessStripeWebhookUseCase(
      this.paymentLifecyclePort,
      (process.env.STRIPE_CURRENCY || 'eur').toLowerCase(),
    );
  }

  private async getStripeConfigSnapshot(brandId: string, localId: string): Promise<StripeConfigSnapshot> {
    const [brandConfig, locationConfig] = await Promise.all([
      this.tenantConfig.getBrandConfig(brandId),
      this.tenantConfig.getLocationConfig(localId),
    ]);
    const brandStripe = brandConfig.payments?.stripe || {};
    const locationStripe = locationConfig.payments?.stripe || {};
    const mode = brandStripe.mode === 'brand' ? 'brand' : 'location';
    return {
      mode,
      brandEnabled: brandStripe.enabled === true,
      platformEnabled: locationStripe.platformEnabled !== false,
      localEnabled: locationStripe.enabled === true,
      brandAccountId: brandStripe.accountId,
      localAccountId: locationStripe.accountId,
    };
  }

  private async updateBrandStripeConfig(
    brandId: string,
    updates: Partial<{ enabled: boolean; mode: 'brand' | 'location'; accountId: string } & StripeAccountStatus>,
  ) {
    const current = await this.prisma.brandConfig.findUnique({
      where: { brandId },
      select: { data: true },
    });
    const data = (current?.data || {}) as Record<string, any>;
    const payments = { ...(data.payments || {}) };
    const stripe = { ...(payments.stripe || {}) };
    const nextStripe = { ...stripe, ...updates };
    const next = { ...data, payments: { ...payments, stripe: nextStripe } };
    await this.prisma.brandConfig.upsert({
      where: { brandId },
      update: { data: next as Prisma.InputJsonValue },
      create: { brandId, data: next as Prisma.InputJsonValue },
    });
    return nextStripe;
  }

  private async updateLocationStripeConfig(
    localId: string,
    updates: Partial<{ enabled: boolean; accountId: string } & StripeAccountStatus>,
  ) {
    const current = await this.prisma.locationConfig.findUnique({
      where: { localId },
      select: { data: true },
    });
    const data = (current?.data || {}) as Record<string, any>;
    const payments = { ...(data.payments || {}) };
    const stripe = { ...(payments.stripe || {}) };
    const nextStripe = { ...stripe, ...updates };
    const next = { ...data, payments: { ...payments, stripe: nextStripe } };
    await this.prisma.locationConfig.upsert({
      where: { localId },
      update: { data: next as Prisma.InputJsonValue },
      create: { localId, data: next as Prisma.InputJsonValue },
    });
    return nextStripe;
  }

  private async syncStripeAccountStatus(
    accountId: string,
    scope: 'brand' | 'location',
    scopeId: string,
  ): Promise<StripeAccountStatus> {
    const status = await this.stripeGateway.getAccountStatus({ accountId });
    if (scope === 'brand') {
      await this.updateBrandStripeConfig(scopeId, status);
    } else {
      await this.updateLocationStripeConfig(scopeId, status);
    }
    return status;
  }

  async getStripeAvailability(params: {
    brandId: string;
    localId: string;
    publishableKey: string | null;
  }): Promise<CommerceOnlinePaymentAvailability> {
    const snapshot = await this.getStripeConfigSnapshot(params.brandId, params.localId);
    if (!snapshot.brandEnabled) {
      return {
        enabled: false,
        reason: 'disabled',
        mode: snapshot.mode,
        publishableKey: params.publishableKey,
      };
    }
    if (!snapshot.platformEnabled) {
      return {
        enabled: false,
        reason: 'platform_disabled',
        mode: snapshot.mode,
        publishableKey: params.publishableKey,
      };
    }
    if (!snapshot.localEnabled) {
      return {
        enabled: false,
        reason: 'local_disabled',
        mode: snapshot.mode,
        publishableKey: params.publishableKey,
      };
    }

    const accountId =
      snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
    if (!accountId) {
      return {
        enabled: false,
        reason: 'account_missing',
        mode: snapshot.mode,
        publishableKey: params.publishableKey,
      };
    }

    const status = await this.syncStripeAccountStatus(
      accountId,
      snapshot.mode,
      snapshot.mode === 'brand' ? params.brandId : params.localId,
    );
    const ready = status.chargesEnabled && status.detailsSubmitted;
    return {
      enabled: ready,
      mode: snapshot.mode,
      status,
      publishableKey: params.publishableKey,
    };
  }

  async getAdminStripeConfig(params: { brandId: string; localId: string }) {
    const snapshot = await this.getStripeConfigSnapshot(params.brandId, params.localId);
    const accountId =
      snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
    const status = accountId
      ? await this.syncStripeAccountStatus(
          accountId,
          snapshot.mode,
          snapshot.mode === 'brand' ? params.brandId : params.localId,
        )
      : null;
    return {
      mode: snapshot.mode,
      brandEnabled: snapshot.brandEnabled,
      platformEnabled: snapshot.platformEnabled,
      localEnabled: snapshot.localEnabled,
      accountIdExists: Boolean(accountId),
      status,
    };
  }

  async updateLocalStripeEnabled(params: {
    brandId: string;
    localId: string;
    enabled: boolean;
  }) {
    const snapshot = await this.getStripeConfigSnapshot(params.brandId, params.localId);
    if (!snapshot.brandEnabled) {
      throw new BadRequestException('Stripe no está habilitado por la marca.');
    }
    if (!snapshot.platformEnabled) {
      throw new BadRequestException('Stripe no está habilitado para este local.');
    }
    await this.updateLocationStripeConfig(params.localId, { enabled: params.enabled });
    return { enabled: params.enabled };
  }

  async createStripeOnboardingLink(params: {
    scope: 'brand' | 'location';
    scopeId: string;
    baseUrl: string;
    country: string;
  }) {
    if (params.scope === 'brand') {
      const brand = await this.prisma.brand.findUnique({ where: { id: params.scopeId } });
      if (!brand) throw new NotFoundException('Marca no encontrada.');
      const config = await this.tenantConfig.getBrandConfig(params.scopeId);
      const stripeConfig = config.payments?.stripe || {};
      if (stripeConfig.mode !== 'brand') {
        throw new BadRequestException('La marca no está configurada para pagos centralizados.');
      }
      const accountId = stripeConfig.accountId
        || (await this.stripeGateway.createExpressAccount({
          country: params.country,
          businessName: brand.name,
          productDescription: 'Reservas y pagos en Managgio',
        })).id;
      await this.updateBrandStripeConfig(params.scopeId, { accountId });
      const link = await this.stripeGateway.createAccountLink({
        accountId,
        refreshUrl: `${params.baseUrl}/platform/brands`,
        returnUrl: `${params.baseUrl}/platform/brands`,
      });
      return { url: link.url, accountId };
    }

    const location = await this.prisma.location.findUnique({ where: { id: params.scopeId } });
    if (!location) throw new NotFoundException('Local no encontrado.');
    const brandConfig = await this.tenantConfig.getBrandConfig(location.brandId);
    const brandStripe = brandConfig.payments?.stripe || {};
    if (brandStripe.mode === 'brand') {
      throw new BadRequestException('La marca está configurada para pagos centralizados.');
    }
    const config = await this.tenantConfig.getLocationConfig(params.scopeId);
    const stripeConfig = config.payments?.stripe || {};
    if (stripeConfig.platformEnabled === false) {
      throw new BadRequestException('Stripe está desactivado para este local.');
    }
    const accountId = stripeConfig.accountId
      || (await this.stripeGateway.createExpressAccount({
        country: params.country,
        businessName: location.name,
        productDescription: 'Reservas y pagos en Managgio',
      })).id;
    await this.updateLocationStripeConfig(params.scopeId, { accountId });
    const link = await this.stripeGateway.createAccountLink({
      accountId,
      refreshUrl: `${params.baseUrl}/admin/settings`,
      returnUrl: `${params.baseUrl}/admin/settings`,
    });
    return { url: link.url, accountId };
  }

  async createStripeCheckoutSession(params: {
    brandId: string;
    localId: string;
    data: {
      userId?: string | null;
      barberId: string;
      serviceId: string;
      startDateTime: string;
      notes?: string;
      guestName?: string;
      guestContact?: string;
      privacyConsentGiven?: boolean;
      referralAttributionId?: string;
      appliedCouponId?: string;
      useWallet?: boolean;
      products?: Array<{ productId: string; quantity: number }>;
    };
    baseUrl: string;
    defaultCurrency: string;
    paymentTtlMinutes: number;
    requestMeta?: {
      ip?: string | null;
      userAgent?: string | null;
    };
  }) {
    const availability = await this.getStripeAvailability({
      brandId: params.brandId,
      localId: params.localId,
      publishableKey: null,
    });
    if (!availability.enabled) {
      throw new BadRequestException('Los pagos online no están disponibles en este local.');
    }

    if (!params.data.userId) {
      const contact = parseGuestContact(params.data.guestContact);
      if (!contact.email) {
        throw new BadRequestException('Necesitamos un correo para completar el pago.');
      }
    }

    const snapshot = await this.getStripeConfigSnapshot(params.brandId, params.localId);
    const accountId =
      snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
    if (!accountId) {
      throw new BadRequestException('Stripe no está conectado en este local.');
    }

    const expiresAt = new Date(Date.now() + params.paymentTtlMinutes * 60 * 1000);
    const appointment = await this.appointmentsFacade.create(
      {
        userId: params.data.userId ?? null,
        barberId: params.data.barberId,
        serviceId: params.data.serviceId,
        startDateTime: params.data.startDateTime,
        notes: params.data.notes,
        guestName: params.data.guestName,
        guestContact: params.data.guestContact,
        privacyConsentGiven: params.data.privacyConsentGiven,
        referralAttributionId: params.data.referralAttributionId,
        appliedCouponId: params.data.appliedCouponId,
        useWallet: params.data.useWallet,
        products: params.data.products,
      },
      {
        requireConsent: true,
        ip: params.requestMeta?.ip || null,
        userAgent: params.requestMeta?.userAgent || null,
        payment: {
          status: PaymentStatus.pending,
          method: PaymentMethod.stripe,
          currency: params.defaultCurrency,
          expiresAt,
        },
        skipNotifications: true,
      },
    );

    if (appointment.price <= 0) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          paymentStatus: PaymentStatus.exempt,
          paymentAmount: new Prisma.Decimal(0),
          paymentCurrency: params.defaultCurrency,
          paymentExpiresAt: null,
        },
      });
      await this.appointmentsFacade.sendPaymentConfirmation(appointment.id);
      return { mode: 'exempt' as const, appointmentId: appointment.id };
    }

    const customerEmail = params.data.userId
      ? (await this.prisma.user.findUnique({ where: { id: params.data.userId }, select: { email: true } }))?.email
      : parseGuestContact(params.data.guestContact).email;

    const unitAmount = Math.max(0, Math.round(appointment.price * 100));
    if (unitAmount <= 0) {
      throw new BadRequestException('El importe de la cita es inválido.');
    }

    try {
      const session = await this.stripeGateway.createCheckoutSession({
        accountId,
        currency: params.defaultCurrency,
        unitAmount,
        serviceName: appointment.serviceNameSnapshot || 'Cita reservada',
        customerEmail,
        clientReferenceId: appointment.id,
        metadata: {
          appointmentId: appointment.id,
          localId: params.localId,
          brandId: params.brandId,
        },
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
        successUrl: `${params.baseUrl}/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${params.baseUrl}/payment/stripe/cancel?session_id={CHECKOUT_SESSION_ID}`,
      });

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : null,
          paymentAmount: new Prisma.Decimal(appointment.price),
          paymentCurrency: params.defaultCurrency,
          paymentExpiresAt: expiresAt,
        },
      });

      return { mode: 'stripe' as const, checkoutUrl: session.url, appointmentId: appointment.id };
    } catch (error) {
      await this.processStripeWebhookUseCase.cancelPendingAppointmentById({
        appointmentId: appointment.id,
        reason: 'stripe_session_failed',
      });
      throw error;
    }
  }

  async fetchStripeSession(params: { sessionId: string }) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { stripeCheckoutSessionId: params.sessionId },
      select: { localId: true, local: { select: { brandId: true } } },
    });
    if (appointment) {
      const snapshot = await this.getStripeConfigSnapshot(appointment.local.brandId, appointment.localId);
      const accountId =
        snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
      if (accountId) {
        return this.stripeGateway.retrieveCheckoutSession({ sessionId: params.sessionId, accountId });
      }
    }
    return this.stripeGateway.retrieveCheckoutSession({ sessionId: params.sessionId });
  }

  constructWebhookEvent(params: {
    rawBody: Buffer;
    signature?: string;
    webhookSecret?: string;
  }): CommerceOnlinePaymentWebhookEvent {
    return this.stripeGateway.constructWebhookEvent(params) as CommerceOnlinePaymentWebhookEvent;
  }
}
