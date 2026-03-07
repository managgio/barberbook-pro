import { Inject, Injectable } from '@nestjs/common';
import {
  ENGAGEMENT_REFERRAL_CONFIG_MANAGEMENT_PORT,
  EngagementReferralConfigManagementPort,
} from '../../contexts/engagement/ports/outbound/referral-config-management.port';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';

@Injectable()
export class ReferralConfigService {
  constructor(
    @Inject(ENGAGEMENT_REFERRAL_CONFIG_MANAGEMENT_PORT)
    private readonly referralConfigManagementPort: EngagementReferralConfigManagementPort,
  ) {}

  isModuleEnabled() {
    return this.referralConfigManagementPort.isModuleEnabled();
  }

  getConfig() {
    return this.referralConfigManagementPort.getConfig();
  }

  getConfigOrThrow() {
    return this.referralConfigManagementPort.getConfigOrThrow();
  }

  updateConfig(data: UpdateReferralConfigDto) {
    return this.referralConfigManagementPort.updateConfig(data);
  }

  applyTemplate(templateId: string) {
    return this.referralConfigManagementPort.applyTemplate(templateId);
  }

  copyFromLocation(sourceLocationId: string) {
    return this.referralConfigManagementPort.copyFromLocation(sourceLocationId);
  }
}
