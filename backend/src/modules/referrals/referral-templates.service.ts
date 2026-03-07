import { Inject, Injectable } from '@nestjs/common';
import { ManageReferralTemplatesUseCase } from '../../contexts/engagement/application/use-cases/manage-referral-templates.use-case';
import {
  ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT,
  EngagementReferralTemplateManagementPort,
} from '../../contexts/engagement/ports/outbound/referral-template-management.port';
import { CreateReferralTemplateDto } from './dto/create-referral-template.dto';
import { UpdateReferralTemplateDto } from './dto/update-referral-template.dto';

@Injectable()
export class ReferralTemplatesService {
  private readonly manageReferralTemplatesUseCase: ManageReferralTemplatesUseCase;

  constructor(
    @Inject(ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT)
    private readonly referralTemplateManagementPort: EngagementReferralTemplateManagementPort,
  ) {
    this.manageReferralTemplatesUseCase = new ManageReferralTemplatesUseCase(this.referralTemplateManagementPort);
  }

  list(brandId: string) {
    return this.manageReferralTemplatesUseCase.list(brandId);
  }

  listForLocal(localId: string) {
    return this.manageReferralTemplatesUseCase.listForLocal(localId);
  }

  create(brandId: string, data: CreateReferralTemplateDto) {
    return this.manageReferralTemplatesUseCase.create(brandId, data);
  }

  update(id: string, data: UpdateReferralTemplateDto) {
    return this.manageReferralTemplatesUseCase.update(id, data);
  }

  remove(id: string) {
    return this.manageReferralTemplatesUseCase.remove(id);
  }
}
