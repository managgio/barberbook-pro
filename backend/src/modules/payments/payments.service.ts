import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentBrandId, getCurrentLocalId, runWithTenantContextAsync } from '../../tenancy/tenant.context';
import { runForEachActiveLocation } from '../../tenancy/tenant.utils';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';

const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const DEFAULT_PAYMENT_TTL_MINUTES = Math.max(30, Number(process.env.STRIPE_PAYMENT_TTL_MINUTES || 30));

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
export class PaymentsService {
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly appointmentsService: AppointmentsService,
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

  private getPublishableKey() {
    return process.env.STRIPE_PUBLIC_KEY || null;
  }

  private async getStripeConfigSnapshot(
    brandId = getCurrentBrandId(),
    localId = getCurrentLocalId(),
  ): Promise<StripeConfigSnapshot> {
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

  private async syncStripeAccountStatus(
    accountId: string,
    scope: 'brand' | 'location',
    scopeId: string,
  ): Promise<StripeAccountStatus> {
    const stripe = this.getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    const status: StripeAccountStatus = {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    };
    if (scope === 'brand') {
      await this.updateBrandStripeConfig(scopeId, status);
    } else {
      await this.updateLocationStripeConfig(scopeId, status);
    }
    return status;
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

  async getStripeAvailability() {
    const localId = getCurrentLocalId();
    const brandId = getCurrentBrandId();
    const snapshot = await this.getStripeConfigSnapshot(brandId, localId);
    if (!snapshot.brandEnabled) {
      return {
        enabled: false,
        reason: 'disabled',
        mode: snapshot.mode,
        publishableKey: this.getPublishableKey(),
      };
    }
    if (!snapshot.platformEnabled) {
      return {
        enabled: false,
        reason: 'platform_disabled',
        mode: snapshot.mode,
        publishableKey: this.getPublishableKey(),
      };
    }
    if (!snapshot.localEnabled) {
      return {
        enabled: false,
        reason: 'local_disabled',
        mode: snapshot.mode,
        publishableKey: this.getPublishableKey(),
      };
    }

    const accountId =
      snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
    if (!accountId) {
      return {
        enabled: false,
        reason: 'account_missing',
        mode: snapshot.mode,
        publishableKey: this.getPublishableKey(),
      };
    }

    const status = await this.syncStripeAccountStatus(
      accountId,
      snapshot.mode,
      snapshot.mode === 'brand' ? brandId : localId,
    );
    const ready = status.chargesEnabled && status.detailsSubmitted;
    return {
      enabled: ready,
      mode: snapshot.mode,
      status,
      publishableKey: this.getPublishableKey(),
    };
  }

  async getAdminStripeConfig() {
    const localId = getCurrentLocalId();
    const brandId = getCurrentBrandId();
    const snapshot = await this.getStripeConfigSnapshot(brandId, localId);
    const accountId =
      snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
    const status = accountId
      ? await this.syncStripeAccountStatus(
          accountId,
          snapshot.mode,
          snapshot.mode === 'brand' ? brandId : localId,
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

  async updateLocalStripeEnabled(enabled: boolean) {
    const snapshot = await this.getStripeConfigSnapshot();
    if (!snapshot.brandEnabled) {
      throw new BadRequestException('Stripe no está habilitado por la marca.');
    }
    if (!snapshot.platformEnabled) {
      throw new BadRequestException('Stripe no está habilitado para este local.');
    }
    await this.updateLocationStripeConfig(getCurrentLocalId(), { enabled });
    return { enabled };
  }

  async createStripeOnboardingLink(scope: 'brand' | 'location', scopeId: string, baseUrl: string) {
    const stripe = this.getStripeClient();
    const country = process.env.STRIPE_DEFAULT_COUNTRY || 'ES';

    if (scope === 'brand') {
      const brand = await this.prisma.brand.findUnique({ where: { id: scopeId } });
      if (!brand) throw new NotFoundException('Marca no encontrada.');
      const config = await this.tenantConfig.getBrandConfig(scopeId);
      const stripeConfig = config.payments?.stripe || {};
      if (stripeConfig.mode !== 'brand') {
        throw new BadRequestException('La marca no está configurada para pagos centralizados.');
      }
      const accountId = stripeConfig.accountId
        || (await stripe.accounts.create({
          type: 'express',
          country,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_profile: {
            name: brand.name,
            product_description: 'Reservas y pagos en Managgio',
          },
        })).id;
      await this.updateBrandStripeConfig(scopeId, { accountId });
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/platform/brands`,
        return_url: `${baseUrl}/platform/brands`,
        type: 'account_onboarding',
      });
      return { url: link.url, accountId };
    }

    const location = await this.prisma.location.findUnique({ where: { id: scopeId } });
    if (!location) throw new NotFoundException('Local no encontrado.');
    const brandConfig = await this.tenantConfig.getBrandConfig(location.brandId);
    const brandStripe = brandConfig.payments?.stripe || {};
    if (brandStripe.mode === 'brand') {
      throw new BadRequestException('La marca está configurada para pagos centralizados.');
    }
    const config = await this.tenantConfig.getLocationConfig(scopeId);
    const stripeConfig = config.payments?.stripe || {};
    if (stripeConfig.platformEnabled === false) {
      throw new BadRequestException('Stripe está desactivado para este local.');
    }
    const accountId = stripeConfig.accountId
      || (await stripe.accounts.create({
        type: 'express',
        country,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: location.name,
          product_description: 'Reservas y pagos en Managgio',
        },
      })).id;
    await this.updateLocationStripeConfig(scopeId, { accountId });
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/admin/settings`,
      return_url: `${baseUrl}/admin/settings`,
      type: 'account_onboarding',
    });
    return { url: link.url, accountId };
  }

  async createStripeCheckoutSession(data: CreateStripeCheckoutDto, baseUrl: string, requestMeta?: { ip?: string | null; userAgent?: string | null }) {
    const availability = await this.getStripeAvailability();
    if (!availability.enabled) {
      throw new BadRequestException('Los pagos online no están disponibles en este local.');
    }

    if (!data.userId) {
      const contact = parseGuestContact(data.guestContact);
      if (!contact.email) {
        throw new BadRequestException('Necesitamos un correo para completar el pago.');
      }
    }

    const snapshot = await this.getStripeConfigSnapshot();
    const accountId =
      snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
    if (!accountId) {
      throw new BadRequestException('Stripe no está conectado en este local.');
    }

    const expiresAt = new Date(Date.now() + DEFAULT_PAYMENT_TTL_MINUTES * 60 * 1000);
    const appointment = await this.appointmentsService.create(
      {
        userId: data.userId ?? null,
        barberId: data.barberId,
        serviceId: data.serviceId,
        startDateTime: data.startDateTime,
        notes: data.notes,
        guestName: data.guestName,
        guestContact: data.guestContact,
        privacyConsentGiven: data.privacyConsentGiven,
        referralAttributionId: data.referralAttributionId,
        appliedCouponId: data.appliedCouponId,
        useWallet: data.useWallet,
        products: data.products,
      },
      {
        requireConsent: true,
        ip: requestMeta?.ip || null,
        userAgent: requestMeta?.userAgent || null,
        payment: {
          status: PaymentStatus.pending,
          method: PaymentMethod.stripe,
          currency: DEFAULT_CURRENCY,
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
          paymentCurrency: DEFAULT_CURRENCY,
          paymentExpiresAt: null,
        },
      });
      await this.appointmentsService.sendPaymentConfirmation(appointment.id);
      return { mode: 'exempt', appointmentId: appointment.id };
    }

    const stripe = this.getStripeClient();
    const customerEmail = data.userId
      ? (await this.prisma.user.findUnique({ where: { id: data.userId }, select: { email: true } }))?.email
      : parseGuestContact(data.guestContact).email;

    const unitAmount = Math.max(0, Math.round(appointment.price * 100));
    if (unitAmount <= 0) {
      throw new BadRequestException('El importe de la cita es inválido.');
    }

    try {
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
                  name: appointment.serviceNameSnapshot || 'Cita reservada',
                },
              },
              quantity: 1,
            },
          ],
          customer_email: customerEmail || undefined,
          client_reference_id: appointment.id,
          metadata: {
            appointmentId: appointment.id,
            localId: getCurrentLocalId(),
            brandId: getCurrentBrandId(),
          },
          expires_at: Math.floor(expiresAt.getTime() / 1000),
          success_url: `${baseUrl}/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/payment/stripe/cancel?session_id={CHECKOUT_SESSION_ID}`,
        },
        { stripeAccount: accountId },
      );

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : null,
          paymentAmount: new Prisma.Decimal(appointment.price),
          paymentCurrency: DEFAULT_CURRENCY,
          paymentExpiresAt: expiresAt,
        },
      });

      return { mode: 'stripe', checkoutUrl: session.url, appointmentId: appointment.id };
    } catch (error) {
      await this.cancelPendingAppointment(appointment.id, 'stripe_session_failed');
      throw error;
    }
  }

  async fetchStripeSession(sessionId: string) {
    const stripe = this.getStripeClient();
    const appointment = await this.prisma.appointment.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
      select: { localId: true, local: { select: { brandId: true } } },
    });
    if (appointment) {
      const snapshot = await this.getStripeConfigSnapshot(appointment.local.brandId, appointment.localId);
      const accountId =
        snapshot.mode === 'brand' ? snapshot.brandAccountId : snapshot.localAccountId;
      if (accountId) {
        return stripe.checkout.sessions.retrieve(sessionId, { stripeAccount: accountId });
      }
    }
    return stripe.checkout.sessions.retrieve(sessionId);
  }

  async handleStripeWebhook(rawBody: Buffer, signature?: string) {
    const stripe = this.getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;
    if (webhookSecret) {
      if (!signature) throw new BadRequestException('Firma de Stripe ausente.');
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (error: any) {
        console.error('Stripe webhook signature error:', error?.message || error);
        throw new BadRequestException('Firma de Stripe invalida.');
      }
    } else {
      event = JSON.parse(rawBody.toString('utf-8')) as Stripe.Event;
    }

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === 'checkout.session.expired') {
      await this.handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === 'payment_intent.succeeded') {
      await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
    }
    if (event.type === 'payment_intent.payment_failed') {
      await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
    }
    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const appointmentId = session.metadata?.appointmentId || session.client_reference_id;
    if (!appointmentId) return;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, localId: true, status: true, local: { select: { brandId: true } } },
    });
    if (!appointment || appointment.status === 'cancelled') return;

    const amountTotal = session.amount_total ? session.amount_total / 100 : null;
    await runWithTenantContextAsync(
      { localId: appointment.localId, brandId: appointment.local.brandId },
      async () => {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          paymentStatus: PaymentStatus.paid,
          paymentPaidAt: new Date(),
          paymentMethod: PaymentMethod.stripe,
          paymentAmount: amountTotal !== null ? new Prisma.Decimal(amountTotal) : undefined,
          paymentCurrency: session.currency || DEFAULT_CURRENCY,
          paymentExpiresAt: null,
        },
      });
      await this.appointmentsService.sendPaymentConfirmation(appointment.id);
    });
  }

  private async handleCheckoutExpired(session: Stripe.Checkout.Session) {
    const appointmentId = session.metadata?.appointmentId || session.client_reference_id;
    if (!appointmentId) return;
    await this.cancelPendingAppointment(appointmentId, 'stripe_expired');
  }

  private async handlePaymentFailed(intent: Stripe.PaymentIntent) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true },
    });
    if (!appointment) return;
    await this.cancelPendingAppointment(appointment.id, 'stripe_payment_failed');
  }

  private async handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { stripePaymentIntentId: intent.id },
      select: { id: true, localId: true, paymentStatus: true, local: { select: { brandId: true } } },
    });
    if (!appointment || appointment.paymentStatus === PaymentStatus.paid) return;
    const amountTotal = typeof intent.amount_received === 'number' ? intent.amount_received / 100 : null;
    await runWithTenantContextAsync(
      { localId: appointment.localId, brandId: appointment.local.brandId },
      async () => {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            paymentStatus: PaymentStatus.paid,
            paymentPaidAt: new Date(),
            paymentMethod: PaymentMethod.stripe,
            paymentAmount: amountTotal !== null ? new Prisma.Decimal(amountTotal) : undefined,
            paymentCurrency: intent.currency || DEFAULT_CURRENCY,
            paymentExpiresAt: null,
          },
        });
        await this.appointmentsService.sendPaymentConfirmation(appointment.id);
      },
    );
  }

  private async cancelPendingAppointment(appointmentId: string, reason: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, localId: true, status: true, paymentStatus: true, local: { select: { brandId: true } } },
    });
    if (!appointment) return;
    if (appointment.status === 'cancelled' || appointment.status === 'completed') return;
    if (appointment.paymentStatus === PaymentStatus.paid) return;

    await runWithTenantContextAsync(
      { localId: appointment.localId, brandId: appointment.local.brandId },
      async () => {
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          paymentStatus: PaymentStatus.cancelled,
          paymentExpiresAt: null,
        },
      });
      await this.appointmentsService.update(appointmentId, { status: 'cancelled' }, { actorUserId: null });
    });
  }

  async cancelExpiredStripePayments() {
    const now = new Date();
    let cancelled = 0;

    await runForEachActiveLocation(this.prisma, async ({ localId }) => {
      const pending = await this.prisma.appointment.findMany({
        where: {
          localId,
          paymentStatus: PaymentStatus.pending,
          paymentExpiresAt: { lt: now },
          status: { not: 'cancelled' },
        },
        select: { id: true },
      });
      for (const appointment of pending) {
        await this.cancelPendingAppointment(appointment.id, 'stripe_timeout');
      }
      cancelled += pending.length;
    });

    return { cancelled };
  }
}
