import { DEFAULT_SHOP_SCHEDULE, ShopSchedule } from '../schedules/schedule.types';
import { cloneSchedule, normalizeSchedule } from '../schedules/schedule.utils';

export type SiteStats = {
  experienceStartYear: number;
  averageRating: number;
  yearlyBookings: number;
  repeatClientsPercentage: number;
};

export type SocialLinks = {
  instagram?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
};

export type QrSticker = {
  url: string;
  imageUrl: string;
  imageFileId: string;
  createdAt: string;
};

export type SiteSettings = {
  branding: {
    name: string;
    shortName: string;
    tagline: string;
    description: string;
  };
  location: {
    label: string;
    mapUrl: string;
    mapEmbedUrl: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  socials: SocialLinks;
  stats: SiteStats;
  openingHours: ShopSchedule;
  appointments: {
    cancellationCutoffHours: number;
  };
  services: {
    categoriesEnabled: boolean;
  };
  products: {
    enabled: boolean;
    categoriesEnabled: boolean;
    clientPurchaseEnabled: boolean;
    showOnLanding: boolean;
  };
  qrSticker: QrSticker | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  branding: {
    name: 'Le Blond Hair Salon',
    shortName: 'Le Blond',
    tagline: 'Tu look, nuestro compromiso.',
    description:
      "Estamos en Canet d'en Berenguer y nos dedicamos a crear cortes, color y peinados a medida para quienes buscan estilo y cuidado premium.",
  },
  location: {
    label: "Le Blond Hair Salon, Canet d'en Berenguer (Valencia)",
    mapUrl:
      'https://www.google.com/maps/place/Le+Blond+Hair+Salon/@39.68116,-0.207122,14587m/data=!3m1!1e3!4m6!3m5!1s0xd601740819dc665:0x309bee06711ecc9b!8m2!3d39.6811601!4d-0.2071223!16s%2Fg%2F11vd759r3v',
    mapEmbedUrl: 'https://www.google.com/maps?q=Le+Blond+Hair+Salon&output=embed',
  },
  contact: {
    phone: '+34656610045',
    email: 'info.leblondhairsalon@gmail.com',
  },
  socials: {
    instagram: 'leblondhairsalon',
    x: '',
    tiktok: '',
    youtube: '',
    linkedin: '',
  },
  stats: {
    experienceStartYear: 2009,
    averageRating: 4.9,
    yearlyBookings: 5000,
    repeatClientsPercentage: 80,
  },
  openingHours: cloneSchedule(DEFAULT_SHOP_SCHEDULE),
  appointments: {
    cancellationCutoffHours: 0,
  },
  services: {
    categoriesEnabled: false,
  },
  products: {
    enabled: false,
    categoriesEnabled: false,
    clientPurchaseEnabled: false,
    showOnLanding: false,
  },
  qrSticker: null,
};

export const normalizeSettings = (data?: Partial<SiteSettings>): SiteSettings => ({
  branding: { ...DEFAULT_SITE_SETTINGS.branding, ...(data?.branding ?? {}) },
  location: { ...DEFAULT_SITE_SETTINGS.location, ...(data?.location ?? {}) },
  contact: { ...DEFAULT_SITE_SETTINGS.contact, ...(data?.contact ?? {}) },
  socials: { ...DEFAULT_SITE_SETTINGS.socials, ...(data?.socials ?? {}) },
  stats: { ...DEFAULT_SITE_SETTINGS.stats, ...(data?.stats ?? {}) },
  openingHours: data?.openingHours
    ? normalizeSchedule(data.openingHours)
    : cloneSchedule(DEFAULT_SITE_SETTINGS.openingHours),
  appointments: {
    ...DEFAULT_SITE_SETTINGS.appointments,
    ...(data?.appointments ?? {}),
  },
  services: {
    ...DEFAULT_SITE_SETTINGS.services,
    ...(data?.services ?? {}),
  },
  products: {
    ...DEFAULT_SITE_SETTINGS.products,
    ...(data?.products ?? {}),
  },
  qrSticker: data?.qrSticker ?? null,
});

export const cloneSettings = (settings: SiteSettings): SiteSettings =>
  JSON.parse(JSON.stringify(settings));
