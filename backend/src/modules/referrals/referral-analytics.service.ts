import { Injectable } from '@nestjs/common';
import { ReferralAttributionService } from './referral-attribution.service';

@Injectable()
export class ReferralAnalyticsService {
  constructor(private readonly attributionService: ReferralAttributionService) {}

  getOverview(params: { from?: Date; to?: Date }) {
    return this.attributionService.getOverview(params);
  }
}
