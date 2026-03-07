import { Inject, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma, UserSubscriptionStatus } from '@prisma/client';
import {
  CommerceAppointmentPaymentLifecycleState,
  CommercePaymentLifecyclePort,
} from '../../../contexts/commerce/ports/outbound/payment-lifecycle.port';
import {
  TENANT_CONTEXT_RUNNER_PORT,
  TenantContextRunnerPort,
} from '../../../contexts/platform/ports/outbound/tenant-context-runner.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppointmentsFacade } from '../../appointments/appointments.facade';

type AppointmentLifecycleRecord = Prisma.AppointmentGetPayload<{
  select: {
    id: true;
    localId: true;
    status: true;
    paymentStatus: true;
    local: { select: { brandId: true } };
  };
}>;

const mapAppointment = (
  appointment: AppointmentLifecycleRecord,
): CommerceAppointmentPaymentLifecycleState => ({
  id: appointment.id,
  localId: appointment.localId,
  brandId: appointment.local.brandId,
  status: appointment.status,
  paymentStatus: appointment.paymentStatus,
});

@Injectable()
export class PrismaPaymentLifecycleAdapter implements CommercePaymentLifecyclePort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_RUNNER_PORT)
    private readonly tenantContextRunnerPort: TenantContextRunnerPort,
    private readonly appointmentsFacade: AppointmentsFacade,
  ) {}

  async findAppointmentById(appointmentId: string): Promise<CommerceAppointmentPaymentLifecycleState | null> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        localId: true,
        status: true,
        paymentStatus: true,
        local: { select: { brandId: true } },
      },
    });
    return appointment ? mapAppointment(appointment) : null;
  }

  async findAppointmentByPaymentIntent(
    paymentIntentId: string,
  ): Promise<CommerceAppointmentPaymentLifecycleState | null> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      select: {
        id: true,
        localId: true,
        status: true,
        paymentStatus: true,
        local: { select: { brandId: true } },
      },
    });
    return appointment ? mapAppointment(appointment) : null;
  }

  async findExpiredPendingAppointmentIds(params: { localId: string; now: Date }): Promise<string[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId: params.localId,
        paymentStatus: PaymentStatus.pending,
        paymentExpiresAt: { lt: params.now },
        status: { not: 'cancelled' },
      },
      select: { id: true },
    });
    return appointments.map((appointment) => appointment.id);
  }

  async markAppointmentPaid(params: {
    appointmentId: string;
    localId: string;
    brandId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }): Promise<void> {
    await this.tenantContextRunnerPort.runWithContext(
      { localId: params.localId, brandId: params.brandId },
      async () => {
        await this.prisma.appointment.update({
          where: { id: params.appointmentId },
          data: {
            paymentStatus: PaymentStatus.paid,
            paymentPaidAt: params.paidAt,
            paymentMethod: PaymentMethod.stripe,
            paymentAmount:
              params.amountTotal !== null ? new Prisma.Decimal(params.amountTotal) : undefined,
            paymentCurrency: params.currency,
            paymentExpiresAt: null,
          },
        });
        await this.appointmentsFacade.sendPaymentConfirmation(params.appointmentId);
      },
    );
  }

  async cancelAppointmentPaymentAndBooking(params: {
    appointmentId: string;
    localId: string;
    brandId: string;
    reason: string;
    cancelledAt: Date;
  }): Promise<void> {
    await this.tenantContextRunnerPort.runWithContext(
      { localId: params.localId, brandId: params.brandId },
      async () => {
        await this.prisma.appointment.update({
          where: { id: params.appointmentId },
          data: {
            paymentStatus: PaymentStatus.cancelled,
            paymentExpiresAt: null,
          },
        });
        await this.appointmentsFacade.update(
          params.appointmentId,
          { status: 'cancelled' },
          { actorUserId: null },
        );
      },
    );
  }

  async markSubscriptionPaidById(params: {
    subscriptionId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }): Promise<void> {
    await this.prisma.userSubscription.updateMany({
      where: { id: params.subscriptionId, paymentStatus: PaymentStatus.pending },
      data: {
        paymentStatus: PaymentStatus.paid,
        paymentPaidAt: params.paidAt,
        paymentMethod: PaymentMethod.stripe,
        paymentAmount: params.amountTotal !== null ? new Prisma.Decimal(params.amountTotal) : undefined,
        paymentCurrency: params.currency,
      },
    });
  }

  async cancelPendingSubscriptionById(params: {
    subscriptionId: string;
    cancelledAt: Date;
  }): Promise<void> {
    await this.prisma.userSubscription.updateMany({
      where: { id: params.subscriptionId, paymentStatus: PaymentStatus.pending },
      data: {
        paymentStatus: PaymentStatus.cancelled,
        status: UserSubscriptionStatus.cancelled,
        cancelledAt: params.cancelledAt,
      },
    });
  }

  async failPendingSubscriptionByPaymentIntent(params: {
    paymentIntentId: string;
    failedAt: Date;
  }): Promise<void> {
    await this.prisma.userSubscription.updateMany({
      where: { stripePaymentIntentId: params.paymentIntentId, paymentStatus: PaymentStatus.pending },
      data: {
        paymentStatus: PaymentStatus.failed,
        status: UserSubscriptionStatus.cancelled,
        cancelledAt: params.failedAt,
      },
    });
  }

  async markSubscriptionPaidByPaymentIntent(params: {
    paymentIntentId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }): Promise<void> {
    await this.prisma.userSubscription.updateMany({
      where: {
        stripePaymentIntentId: params.paymentIntentId,
        paymentStatus: { in: [PaymentStatus.pending, PaymentStatus.failed] },
      },
      data: {
        paymentStatus: PaymentStatus.paid,
        paymentPaidAt: params.paidAt,
        paymentMethod: PaymentMethod.stripe,
        paymentAmount: params.amountTotal !== null ? new Prisma.Decimal(params.amountTotal) : undefined,
        paymentCurrency: params.currency,
      },
    });
  }
}
