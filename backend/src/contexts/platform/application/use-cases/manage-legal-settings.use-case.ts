import {
  PlatformLegalManagementPort,
  PlatformLegalPageType,
  PlatformUpdateLegalSettingsInput,
} from '../../ports/outbound/platform-legal-management.port';

export class ManageLegalSettingsUseCase {
  constructor(private readonly legalManagementPort: PlatformLegalManagementPort) {}

  getSettings(brandId?: string, localId?: string | null) {
    return this.legalManagementPort.getSettings(brandId, localId);
  }

  updateSettings(
    brandId: string | undefined,
    data: PlatformUpdateLegalSettingsInput,
    actorUserId?: string | null,
    localId?: string | null,
  ) {
    return this.legalManagementPort.updateSettings(brandId, data, actorUserId, localId);
  }

  getPolicyContent(type: PlatformLegalPageType, brandId?: string, localId?: string | null) {
    return this.legalManagementPort.getPolicyContent(type, brandId, localId);
  }

  recordPrivacyConsent(params: {
    bookingId: string;
    locationId?: string | null;
    consentGiven: boolean;
    ip?: string | null;
    userAgent?: string | null;
    actorUserId?: string | null;
  }) {
    return this.legalManagementPort.recordPrivacyConsent(params);
  }

  hasUserPrivacyConsent(userId: string, policyVersion?: number, brandId?: string) {
    return this.legalManagementPort.hasUserPrivacyConsent(userId, policyVersion, brandId);
  }

  getDpaContent(brandId: string) {
    return this.legalManagementPort.getDpaContent(brandId);
  }
}
