import { BrandConfigData, LocationConfigData } from './tenant-config.types';

const parseNumber = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildBrandConfigFromEnv = (): BrandConfigData => ({
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL?.toLowerCase(),
  i18n: {
    defaultLanguage: 'es',
    supportedLanguages: ['es'],
    autoTranslate: {
      enabled: true,
      paused: false,
      retryAttempts: 2,
      circuitBreaker: {
        enabled: true,
        failureRateThreshold: 0.6,
        minSamples: 12,
        consecutiveFailures: 6,
        windowMinutes: 30,
        pauseMinutes: 30,
      },
    },
  },
  business: {
    type: 'barbershop',
  },
  notificationPrefs: {
    email: true,
    whatsapp: true,
    sms: false,
  },
  features: {
    communicationsEnabled: false,
    multiServiceBookingEnabled: false,
  },
  invoicing: {
    enabled: false,
    taxRate: 21,
    currency: 'EUR',
    seriesPrefix: 'FACT',
  },
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  },
  email: {
    user: process.env.EMAIL,
    password: process.env.PASSWORD,
    host: process.env.EMAIL_HOST,
    port: parseNumber(process.env.EMAIL_PORT),
    fromName: process.env.EMAIL_FROM_NAME,
  },
  firebaseAdmin: {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  },
  ai: {
    provider: process.env.AI_PROVIDER,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    transcriptionModel: process.env.AI_TRANSCRIPTION_MODEL,
    maxTokens: parseNumber(process.env.AI_MAX_TOKENS),
    temperature: parseNumber(process.env.AI_TEMPERATURE),
  },
});

export const buildLocationConfigFromEnv = (): LocationConfigData => ({
  imagekit: {},
});
