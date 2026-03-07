export const PLATFORM_LEGAL_MANAGEMENT_PORT = Symbol('PLATFORM_LEGAL_MANAGEMENT_PORT');

export type PlatformLegalPageType = 'privacy' | 'cookies' | 'notice' | 'dpa';

export type PlatformLegalSection = {
  heading: string;
  bodyMarkdown: string;
};

export type PlatformLegalSubProcessor = {
  name: string;
  purpose: string;
  country: string;
  dataTypes: string;
  link?: string | null;
};

export type PlatformLegalCustomSections = {
  privacy?: PlatformLegalSection[];
  cookies?: PlatformLegalSection[];
  notice?: PlatformLegalSection[];
  dpa?: PlatformLegalSection[];
};

export type PlatformLegalContentResponse = {
  title: string;
  effectiveDate: string;
  version: number;
  sections: PlatformLegalSection[];
  businessIdentity: {
    ownerName: string;
    taxId?: string | null;
    address?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    country?: string | null;
  };
  subProcessors?: PlatformLegalSubProcessor[];
  aiDisclosure?: {
    title: string;
    bodyMarkdown: string;
    providerNames: string[];
  } | null;
};

export type PlatformLegalSettingsResolved = {
  brandId: string;
  ownerName: string;
  taxId: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string;
  privacyPolicyVersion: number;
  cookiePolicyVersion: number;
  legalNoticeVersion: number;
  aiDisclosureEnabled: boolean;
  aiProviderNames: string[];
  subProcessors: PlatformLegalSubProcessor[];
  optionalCustomSections: PlatformLegalCustomSections;
  retentionDays: number | null;
  updatedAt: Date;
};

export type PlatformUpdateLegalSettingsInput = {
  legalOwnerName?: string | null;
  legalOwnerTaxId?: string | null;
  legalOwnerAddress?: string | null;
  legalContactEmail?: string | null;
  legalContactPhone?: string | null;
  country?: string;
  privacyPolicyVersion?: number;
  cookiePolicyVersion?: number;
  legalNoticeVersion?: number;
  aiDisclosureEnabled?: boolean;
  aiProviderNames?: string[];
  subProcessors?: PlatformLegalSubProcessor[];
  optionalCustomSections?: PlatformLegalCustomSections;
  retentionDays?: number | null;
};

export interface PlatformLegalManagementPort {
  getSettings(brandId?: string, localId?: string | null): Promise<PlatformLegalSettingsResolved>;
  updateSettings(
    brandId: string | undefined,
    data: PlatformUpdateLegalSettingsInput,
    actorUserId?: string | null,
    localId?: string | null,
  ): Promise<PlatformLegalSettingsResolved>;
  getPolicyContent(
    type: PlatformLegalPageType,
    brandId?: string,
    localId?: string | null,
  ): Promise<PlatformLegalContentResponse>;
  recordPrivacyConsent(params: {
    bookingId: string;
    locationId?: string | null;
    consentGiven: boolean;
    ip?: string | null;
    userAgent?: string | null;
    actorUserId?: string | null;
  }): Promise<unknown>;
  hasUserPrivacyConsent(userId: string, policyVersion?: number, brandId?: string): Promise<boolean>;
  getDpaContent(brandId: string): Promise<PlatformLegalContentResponse>;
}
