import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RewardsService } from '../../referrals/rewards.service';
import { ReviewRequestService } from '../../reviews/review-request.service';
import {
  COMMERCE_SUBSCRIPTION_POLICY_PORT,
  CommerceSubscriptionPolicyPort,
} from '../../../contexts/commerce/ports/outbound/subscription-policy.port';
import {
  ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT,
  EngagementReferralAttributionPort,
} from '../../../contexts/engagement/ports/outbound/referral-attribution.port';
import {
  BookingSettlementContext,
  BookingStatusSideEffectsPort,
} from '../../../contexts/booking/ports/outbound/booking-status-side-effects.port';

@Injectable()
export class ModuleBookingStatusSideEffectsAdapter implements BookingStatusSideEffectsPort {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly reviewRequestService: ReviewRequestService,
    private readonly prisma: PrismaService,
    @Inject(COMMERCE_SUBSCRIPTION_POLICY_PORT)
    private readonly commerceSubscriptionPolicyPort: CommerceSubscriptionPolicyPort,
    @Inject(ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT)
    private readonly engagementReferralAttributionPort: EngagementReferralAttributionPort,
  ) {}

  confirmWalletHold(appointmentId: string): Promise<void> {
    return this.rewardsService.confirmWalletHold(appointmentId);
  }

  confirmCouponUsage(appointmentId: string): Promise<void> {
    return this.rewardsService.confirmCouponUsage(appointmentId);
  }

  releaseWalletHold(appointmentId: string): Promise<void> {
    return this.rewardsService.releaseWalletHold(appointmentId);
  }

  cancelCouponUsage(appointmentId: string): Promise<void> {
    return this.rewardsService.cancelCouponUsage(appointmentId);
  }

  handleReferralCompleted(appointmentId: string): Promise<void> {
    return this.engagementReferralAttributionPort.handleAppointmentCompleted(appointmentId);
  }

  handleReferralCancelled(appointmentId: string): Promise<void> {
    return this.engagementReferralAttributionPort.handleAppointmentCancelled(appointmentId);
  }

  async handleReviewCompleted(appointmentId: string): Promise<void> {
    await this.reviewRequestService.handleAppointmentCompleted(appointmentId);
  }

  async getAppointmentSettlementContext(params: {
    localId: string;
    appointmentId: string;
  }): Promise<BookingSettlementContext | null> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: params.appointmentId, localId: params.localId },
      select: { subscriptionId: true, paymentMethod: true },
    });

    if (!appointment) return null;

    return {
      subscriptionId: appointment.subscriptionId,
      paymentMethod: appointment.paymentMethod,
    };
  }

  async settleSubscriptionInPersonPayment(params: BookingSettlementContext): Promise<void> {
    await this.commerceSubscriptionPolicyPort.settlePendingInPersonPaymentFromAppointment({
      subscriptionId: params.subscriptionId,
      paymentMethod: params.paymentMethod,
    });
  }
}
