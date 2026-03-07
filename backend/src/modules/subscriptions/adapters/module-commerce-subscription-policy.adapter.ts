import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { CommerceSubscriptionPolicyPort } from '../../../contexts/commerce/ports/outbound/subscription-policy.port';
import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class ModuleCommerceSubscriptionPolicyAdapter implements CommerceSubscriptionPolicyPort {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  resolveActiveSubscriptionForAppointment(userId: string | null | undefined, appointmentDate: Date) {
    return this.subscriptionsService.resolveActiveSubscriptionForAppointment(userId, appointmentDate);
  }

  hasUsableActiveSubscription(userId: string | null | undefined, referenceDate = new Date()) {
    return this.subscriptionsService.hasUsableActiveSubscription(userId, referenceDate);
  }

  async settlePendingInPersonPaymentFromAppointment(params: {
    subscriptionId: string | null | undefined;
    paymentMethod: string | null | undefined;
    completedAt?: Date;
  }): Promise<void> {
    const paymentMethod = this.asPaymentMethod(params.paymentMethod);
    await this.subscriptionsService.settlePendingInPersonPaymentFromAppointment({
      subscriptionId: params.subscriptionId,
      paymentMethod,
      completedAt: params.completedAt,
    });
  }

  private asPaymentMethod(value: string | null | undefined): PaymentMethod | null | undefined {
    if (value == null) return value;
    return (Object.values(PaymentMethod) as string[]).includes(value) ? (value as PaymentMethod) : null;
  }
}
