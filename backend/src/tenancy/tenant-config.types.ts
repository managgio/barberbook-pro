export type TenantImageKitConfig = {
  publicKey?: string;
  privateKey?: string;
  urlEndpoint?: string;
  folder?: string;
};

export type TenantTwilioConfig = {
  accountSid?: string;
  authToken?: string;
  messagingServiceSid?: string;
};

export type TenantEmailConfig = {
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  fromName?: string;
};

export type TenantFirebaseAdminConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

export type TenantAiConfig = {
  provider?: string;
  apiKey?: string;
  model?: string;
  transcriptionModel?: string;
  maxTokens?: number;
  temperature?: number;
};

export type TenantThemeConfig = {
  primary?: string;
};

export type TenantAdminSidebarConfig = {
  hiddenSections?: string[];
};

export type BrandConfigData = {
  superAdminEmail?: string;
  imagekit?: TenantImageKitConfig;
  twilio?: TenantTwilioConfig;
  email?: TenantEmailConfig;
  firebaseAdmin?: TenantFirebaseAdminConfig;
  ai?: TenantAiConfig;
  adminSidebar?: TenantAdminSidebarConfig;
  branding?: {
    name?: string;
    shortName?: string;
    logoUrl?: string;
    logoFileId?: string;
    heroBackgroundUrl?: string;
    heroBackgroundFileId?: string;
    heroImageUrl?: string;
    heroImageFileId?: string;
    signImageUrl?: string;
    signImageFileId?: string;
  };
  theme?: TenantThemeConfig;
};

export type LocationConfigData = {
  imagekit?: Pick<TenantImageKitConfig, 'folder'>;
  adminSidebar?: TenantAdminSidebarConfig;
  theme?: TenantThemeConfig;
};

export type EffectiveTenantConfig = BrandConfigData & LocationConfigData;
