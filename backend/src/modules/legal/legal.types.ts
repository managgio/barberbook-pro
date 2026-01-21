export type LegalPageType = 'privacy' | 'cookies' | 'notice' | 'dpa';

export type LegalSection = {
  heading: string;
  bodyMarkdown: string;
};

export type LegalBusinessIdentity = {
  ownerName: string;
  taxId?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  country?: string | null;
};

export type LegalSubProcessor = {
  name: string;
  purpose: string;
  country: string;
  dataTypes: string;
  link?: string | null;
};

export type LegalAiDisclosure = {
  title: string;
  bodyMarkdown: string;
  providerNames: string[];
};

export type LegalCustomSections = {
  privacy?: LegalSection[];
  cookies?: LegalSection[];
  notice?: LegalSection[];
  dpa?: LegalSection[];
};

export type LegalContentResponse = {
  title: string;
  effectiveDate: string;
  version: number;
  sections: LegalSection[];
  businessIdentity: LegalBusinessIdentity;
  subProcessors?: LegalSubProcessor[];
  aiDisclosure?: LegalAiDisclosure | null;
};

export type LegalSettingsResolved = {
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
  subProcessors: LegalSubProcessor[];
  optionalCustomSections: LegalCustomSections;
  retentionDays: number | null;
  updatedAt: Date;
};
