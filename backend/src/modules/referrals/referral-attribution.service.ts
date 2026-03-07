import { Inject, Injectable } from '@nestjs/common';
import { ReferralAttributionStatus } from '@prisma/client';
import {
  ENGAGEMENT_REFERRAL_ATTRIBUTION_MANAGEMENT_PORT,
  EngagementReferralAttributionManagementPort,
} from '../../contexts/engagement/ports/outbound/referral-attribution-management.port';
import { AttributeReferralDto } from './dto/attribute-referral.dto';

@Injectable()
export class ReferralAttributionService {
  constructor(
    @Inject(ENGAGEMENT_REFERRAL_ATTRIBUTION_MANAGEMENT_PORT)
    private readonly referralAttributionManagementPort: EngagementReferralAttributionManagementPort,
  ) {}

  getRewardSummaryPayload() {
    return this.referralAttributionManagementPort.getRewardSummaryPayload();
  }

  getReferrerSummary(userId: string) {
    return this.referralAttributionManagementPort.getReferrerSummary(userId);
  }

  resolveReferral(code: string) {
    return this.referralAttributionManagementPort.resolveReferral(code);
  }

  attributeReferral(data: AttributeReferralDto) {
    return this.referralAttributionManagementPort.attributeReferral(data);
  }

  resolveAttributionForBooking(params: {
    referralAttributionId?: string | null;
    userId?: string | null;
    guestContact?: string | null;
  }) {
    return this.referralAttributionManagementPort.resolveAttributionForBooking(params);
  }

  attachAttributionToAppointment(params: {
    attributionId: string;
    appointmentId: string;
    userId?: string | null;
    guestContact?: string | null;
    tx?: unknown;
  }) {
    return this.referralAttributionManagementPort.attachAttributionToAppointment(params);
  }

  handleAppointmentCancelled(appointmentId: string): Promise<void> {
    return this.referralAttributionManagementPort.handleAppointmentCancelled(appointmentId);
  }

  handleAppointmentCompleted(appointmentId: string): Promise<void> {
    return this.referralAttributionManagementPort.handleAppointmentCompleted(appointmentId);
  }

  listReferrals(params: {
    status?: ReferralAttributionStatus;
    query?: string;
    page: number;
    pageSize: number;
  }) {
    return this.referralAttributionManagementPort.listReferrals(params);
  }

  getOverview(params: { from?: Date; to?: Date }) {
    return this.referralAttributionManagementPort.getOverview(params);
  }

  voidAttribution(id: string, reason: string) {
    return this.referralAttributionManagementPort.voidAttribution(id, reason);
  }
}
