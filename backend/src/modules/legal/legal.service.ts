import { Inject, Injectable } from '@nestjs/common';
import { ManageLegalSettingsUseCase } from '../../contexts/platform/application/use-cases/manage-legal-settings.use-case';
import {
  PLATFORM_LEGAL_MANAGEMENT_PORT,
  PlatformLegalManagementPort,
  PlatformUpdateLegalSettingsInput,
} from '../../contexts/platform/ports/outbound/platform-legal-management.port';
import { UpdateLegalSettingsDto } from './dto/update-legal-settings.dto';
import { LegalContentResponse, LegalPageType, LegalSettingsResolved } from './legal.types';

@Injectable()
export class LegalService {
  private readonly manageLegalSettingsUseCase: ManageLegalSettingsUseCase;

  constructor(
    @Inject(PLATFORM_LEGAL_MANAGEMENT_PORT)
    private readonly legalManagementPort: PlatformLegalManagementPort,
  ) {
    this.manageLegalSettingsUseCase = new ManageLegalSettingsUseCase(this.legalManagementPort);
  }

  getSettings(brandId?: string, localId?: string | null): Promise<LegalSettingsResolved> {
    return this.manageLegalSettingsUseCase.getSettings(brandId, localId) as Promise<LegalSettingsResolved>;
  }

  updateSettings(
    brandId: string | undefined,
    data: UpdateLegalSettingsDto,
    actorUserId?: string | null,
    localId?: string | null,
  ): Promise<LegalSettingsResolved> {
    return this.manageLegalSettingsUseCase.updateSettings(
      brandId,
      data as PlatformUpdateLegalSettingsInput,
      actorUserId,
      localId,
    ) as Promise<LegalSettingsResolved>;
  }

  getPolicyContent(type: LegalPageType, brandId?: string, localId?: string | null): Promise<LegalContentResponse> {
    return this.manageLegalSettingsUseCase.getPolicyContent(type, brandId, localId) as Promise<LegalContentResponse>;
  }

  recordPrivacyConsent(params: {
    bookingId: string;
    locationId?: string | null;
    consentGiven: boolean;
    ip?: string | null;
    userAgent?: string | null;
    actorUserId?: string | null;
  }) {
    return this.manageLegalSettingsUseCase.recordPrivacyConsent(params);
  }

  hasUserPrivacyConsent(userId: string, policyVersion?: number, brandId?: string): Promise<boolean> {
    return this.manageLegalSettingsUseCase.hasUserPrivacyConsent(userId, policyVersion, brandId);
  }

  getDpaContent(brandId: string): Promise<LegalContentResponse> {
    return this.manageLegalSettingsUseCase.getDpaContent(brandId) as Promise<LegalContentResponse>;
  }
}
