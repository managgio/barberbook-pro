import {
  EngagementCreateReferralTemplateInput,
  EngagementReferralTemplateManagementPort,
  EngagementUpdateReferralTemplateInput,
} from '../../ports/outbound/referral-template-management.port';

export class ManageReferralTemplatesUseCase {
  constructor(private readonly referralTemplateManagementPort: EngagementReferralTemplateManagementPort) {}

  list(brandId: string) {
    return this.referralTemplateManagementPort.list(brandId);
  }

  listForLocal(localId: string) {
    return this.referralTemplateManagementPort.listForLocal(localId);
  }

  create(brandId: string, data: EngagementCreateReferralTemplateInput) {
    return this.referralTemplateManagementPort.create(brandId, data);
  }

  update(id: string, data: EngagementUpdateReferralTemplateInput) {
    return this.referralTemplateManagementPort.update(id, data);
  }

  remove(id: string) {
    return this.referralTemplateManagementPort.remove(id);
  }
}
