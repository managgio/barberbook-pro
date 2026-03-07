import { Inject, Injectable } from '@nestjs/common';
import { ManageReferralCodesUseCase } from '../../contexts/engagement/application/use-cases/manage-referral-codes.use-case';
import {
  ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT,
  EngagementReferralCodeManagementPort,
} from '../../contexts/engagement/ports/outbound/referral-code-management.port';

@Injectable()
export class ReferralCodeService {
  private readonly manageReferralCodesUseCase: ManageReferralCodesUseCase;

  constructor(
    @Inject(ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT)
    private readonly referralCodeManagementPort: EngagementReferralCodeManagementPort,
  ) {
    this.manageReferralCodesUseCase = new ManageReferralCodesUseCase(this.referralCodeManagementPort);
  }

  getOrCreateCode(userId: string) {
    return this.manageReferralCodesUseCase.getOrCreateCode(userId);
  }

  resolveCode(code: string) {
    return this.manageReferralCodesUseCase.resolveCode(code);
  }
}
