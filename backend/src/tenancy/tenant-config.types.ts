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
  smsSenderId?: string;
  whatsappFrom?: string;
  whatsappTemplateSid?: string;
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

export type TenantLandingSectionKey = 'services' | 'products' | 'barbers' | 'cta';

export type TenantLandingConfig = {
  order?: TenantLandingSectionKey[];
  hiddenSections?: TenantLandingSectionKey[];
};

export type TenantNotificationPrefs = {
  email?: boolean;
  whatsapp?: boolean;
  sms?: boolean;
};

export type TenantBrandingConfig = {
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

export type BrandConfigData = {
  superAdminEmail?: string;
  imagekit?: TenantImageKitConfig;
  twilio?: TenantTwilioConfig;
  email?: TenantEmailConfig;
  firebaseAdmin?: TenantFirebaseAdminConfig;
  ai?: TenantAiConfig;
  adminSidebar?: TenantAdminSidebarConfig;
  landing?: TenantLandingConfig;
  notificationPrefs?: TenantNotificationPrefs;
  branding?: TenantBrandingConfig;
  theme?: TenantThemeConfig;
};

export type LocationConfigData = {
  imagekit?: Pick<TenantImageKitConfig, 'folder'>;
  adminSidebar?: TenantAdminSidebarConfig;
  landing?: TenantLandingConfig;
  branding?: Partial<TenantBrandingConfig>;
  theme?: TenantThemeConfig;
  notificationPrefs?: TenantNotificationPrefs;
};

export type EffectiveTenantConfig = BrandConfigData & LocationConfigData;
