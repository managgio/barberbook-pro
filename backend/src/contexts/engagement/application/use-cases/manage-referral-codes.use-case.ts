import { EngagementReferralCodeManagementPort } from '../../ports/outbound/referral-code-management.port';

export class ManageReferralCodesUseCase {
  constructor(private readonly referralCodeManagementPort: EngagementReferralCodeManagementPort) {}

  getOrCreateCode(userId: string) {
    return this.referralCodeManagementPort.getOrCreateCode(userId);
  }

  resolveCode(code: string) {
    return this.referralCodeManagementPort.resolveCode(code);
  }
}
