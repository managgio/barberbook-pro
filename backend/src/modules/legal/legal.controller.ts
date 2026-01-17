import { Controller, Get, Query } from '@nestjs/common';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('privacy')
  getPrivacyPolicy() {
    return this.legalService.getPolicyContent('privacy');
  }

  @Get('cookies')
  getCookiePolicy() {
    return this.legalService.getPolicyContent('cookies');
  }

  @Get('notice')
  getLegalNotice() {
    return this.legalService.getPolicyContent('notice');
  }

  @Get('privacy/consent-status')
  async getPrivacyConsentStatus(@Query('userId') userId?: string) {
    const settings = await this.legalService.getSettings();
    const policyVersion = settings.privacyPolicyVersion;
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!normalizedUserId) {
      return { required: true, policyVersion };
    }
    const hasConsent = await this.legalService.hasUserPrivacyConsent(normalizedUserId, policyVersion);
    return { required: !hasConsent, policyVersion };
  }
}
