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
  mode?: 'dark' | 'light';
};

export type TenantAdminSidebarConfig = {
  hiddenSections?: string[];
};

export type TenantLandingSectionKey = 'presentation' | 'services' | 'products' | 'barbers' | 'cta';

export type TenantLandingPresentationSection = {
  enabled?: boolean;
  imageUrl?: string;
  imageFileId?: string;
  title?: string;
  body?: string;
  imagePosition?: 'left' | 'right';
};

export type TenantLandingPresentationConfig = {
  sections?: TenantLandingPresentationSection[];
};

export type TenantLandingConfig = {
  order?: TenantLandingSectionKey[];
  hiddenSections?: TenantLandingSectionKey[];
  presentation?: TenantLandingPresentationConfig;
};

export type TenantNotificationPrefs = {
  email?: boolean;
  whatsapp?: boolean;
  sms?: boolean;
};

export type TenantFeaturesConfig = {
  barberServiceAssignmentEnabled?: boolean;
};

export type TenantBusinessType =
  | 'barbershop'
  | 'hair_salon'
  | 'aesthetics'
  | 'nails'
  | 'physio'
  | 'clinic'
  | 'mixed_center';

export type TenantBusinessConfig = {
  type?: TenantBusinessType;
};

export type StripePaymentsMode = 'brand' | 'location';

export type TenantStripePaymentsConfig = {
  enabled?: boolean;
  platformEnabled?: boolean;
  mode?: StripePaymentsMode;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
};

export type TenantPaymentsConfig = {
  stripe?: TenantStripePaymentsConfig;
};

export type TenantBrandingConfig = {
  name?: string;
  shortName?: string;
  logoUrl?: string;
  logoFileId?: string;
  logoLightUrl?: string;
  logoLightFileId?: string;
  logoDarkUrl?: string;
  logoDarkFileId?: string;
  heroBackgroundUrl?: string;
  heroBackgroundFileId?: string;
  heroBackgroundDimmed?: boolean;
  heroBackgroundOpacity?: number;
  heroBadgeEnabled?: boolean;
  heroImageUrl?: string;
  heroImageFileId?: string;
  heroImage2Url?: string;
  heroImage2FileId?: string;
  heroImage3Url?: string;
  heroImage3FileId?: string;
  heroImage4Url?: string;
  heroImage4FileId?: string;
  heroImage5Url?: string;
  heroImage5FileId?: string;
  heroImageEnabled?: boolean;
  heroTextColor?: 'auto' | 'white' | 'black' | 'gray-dark' | 'gray-light';
  heroLocationCardEnabled?: boolean;
  heroImagePosition?: 'left' | 'right';
  heroNoImageAlign?: 'center' | 'right' | 'left';
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
  payments?: TenantPaymentsConfig;
  adminSidebar?: TenantAdminSidebarConfig;
  landing?: TenantLandingConfig;
  notificationPrefs?: TenantNotificationPrefs;
  features?: TenantFeaturesConfig;
  business?: TenantBusinessConfig;
  branding?: TenantBrandingConfig;
  theme?: TenantThemeConfig;
};

export type LocationConfigData = {
  imagekit?: Pick<TenantImageKitConfig, 'folder'>;
  payments?: TenantPaymentsConfig;
  adminSidebar?: TenantAdminSidebarConfig;
  landing?: TenantLandingConfig;
  features?: TenantFeaturesConfig;
  branding?: Partial<TenantBrandingConfig>;
  theme?: TenantThemeConfig;
  notificationPrefs?: TenantNotificationPrefs;
};

export type EffectiveTenantConfig = BrandConfigData & LocationConfigData;
