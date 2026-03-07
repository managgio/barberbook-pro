import { Inject, Injectable, Logger } from '@nestjs/common';
import { ManageOnlinePaymentsUseCase } from '../../contexts/commerce/application/use-cases/manage-online-payments.use-case';
import { ProcessStripeWebhookUseCase } from '../../contexts/commerce/application/use-cases/process-stripe-webhook.use-case';
import {
  COMMERCE_PAYMENT_LIFECYCLE_PORT,
  CommercePaymentLifecyclePort,
} from '../../contexts/commerce/ports/outbound/payment-lifecycle.port';
import {
  COMMERCE_PAYMENT_MANAGEMENT_PORT,
  CommercePaymentManagementPort,
} from '../../contexts/commerce/ports/outbound/payment-management.port';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';

const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const DEFAULT_PAYMENT_TTL_MINUTES = Math.max(30, Number(process.env.STRIPE_PAYMENT_TTL_MINUTES || 30));

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly processStripeWebhookUseCase: ProcessStripeWebhookUseCase;
  private readonly manageOnlinePaymentsUseCase: ManageOnlinePaymentsUseCase;

  constructor(
    @Inject(COMMERCE_PAYMENT_MANAGEMENT_PORT)
    private readonly paymentManagementPort: CommercePaymentManagementPort,
    @Inject(COMMERCE_PAYMENT_LIFECYCLE_PORT)
    private readonly paymentLifecyclePort: CommercePaymentLifecyclePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
  ) {
    this.processStripeWebhookUseCase = new ProcessStripeWebhookUseCase(
      this.paymentLifecyclePort,
      DEFAULT_CURRENCY,
    );
    this.manageOnlinePaymentsUseCase = new ManageOnlinePaymentsUseCase(this.paymentManagementPort);
  }

  private getBrandId() {
    return this.tenantContextPort.getRequestContext().brandId;
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private getPublishableKey() {
    return process.env.STRIPE_PUBLIC_KEY || null;
  }

  getStripeAvailability() {
    return this.manageOnlinePaymentsUseCase.getStripeAvailability({
      brandId: this.getBrandId(),
      localId: this.getLocalId(),
      publishableKey: this.getPublishableKey(),
    });
  }

  getAdminStripeConfig() {
    return this.manageOnlinePaymentsUseCase.getAdminStripeConfig({
      brandId: this.getBrandId(),
      localId: this.getLocalId(),
    });
  }

  updateLocalStripeEnabled(enabled: boolean) {
    return this.manageOnlinePaymentsUseCase.updateLocalStripeEnabled({
      brandId: this.getBrandId(),
      localId: this.getLocalId(),
      enabled,
    });
  }

  createStripeOnboardingLink(scope: 'brand' | 'location', scopeId: string, baseUrl: string) {
    return this.manageOnlinePaymentsUseCase.createStripeOnboardingLink({
      scope,
      scopeId,
      baseUrl,
      country: process.env.STRIPE_DEFAULT_COUNTRY || 'ES',
    });
  }

  createStripeCheckoutSession(
    data: CreateStripeCheckoutDto,
    baseUrl: string,
    requestMeta?: { ip?: string | null; userAgent?: string | null },
  ) {
    return this.manageOnlinePaymentsUseCase.createStripeCheckoutSession({
      brandId: this.getBrandId(),
      localId: this.getLocalId(),
      data,
      baseUrl,
      defaultCurrency: DEFAULT_CURRENCY,
      paymentTtlMinutes: DEFAULT_PAYMENT_TTL_MINUTES,
      requestMeta,
    });
  }

  fetchStripeSession(sessionId: string) {
    return this.manageOnlinePaymentsUseCase.fetchStripeSession({ sessionId });
  }

  async handleStripeWebhook(rawBody: Buffer, signature?: string) {
    const event = this.manageOnlinePaymentsUseCase.constructWebhookEvent({
      rawBody,
      signature,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    if (event.type === 'checkout.session.completed') {
      await this.processStripeWebhookUseCase.handleCheckoutCompleted(event.data.object as any);
    }
    if (event.type === 'checkout.session.expired') {
      await this.processStripeWebhookUseCase.handleCheckoutExpired(event.data.object as any);
    }
    if (event.type === 'payment_intent.succeeded') {
      await this.processStripeWebhookUseCase.handlePaymentSucceeded(event.data.object as any);
    }
    if (event.type === 'payment_intent.payment_failed') {
      await this.processStripeWebhookUseCase.handlePaymentFailed(event.data.object as any);
    }
    return { received: true };
  }

  async cancelExpiredStripePayments() {
    const now = new Date();
    const summary = await runTenantScopedJob({
      jobName: 'payments-expired-cancel',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async ({ localId }) => {
        const result = await this.processStripeWebhookUseCase.cancelExpiredStripePayments({
          localId,
          now,
        });
        return { paymentsCancelled: result.cancelled };
      },
    });

    return { cancelled: summary.metrics.paymentsCancelled || 0 };
  }
}
