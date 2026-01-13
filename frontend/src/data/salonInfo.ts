import { SiteSettings } from './types';

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
  openingHours: {
    monday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '14:00' },
      afternoon: { enabled: true, start: '15:00', end: '20:00' },
    },
    tuesday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '14:00' },
      afternoon: { enabled: true, start: '15:00', end: '20:00' },
    },
    wednesday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '14:00' },
      afternoon: { enabled: true, start: '15:00', end: '20:00' },
    },
    thursday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '14:00' },
      afternoon: { enabled: true, start: '15:00', end: '20:00' },
    },
    friday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '14:00' },
      afternoon: { enabled: true, start: '15:00', end: '21:00' },
    },
    saturday: {
      closed: false,
      morning: { enabled: true, start: '09:30', end: '13:30' },
      afternoon: { enabled: true, start: '15:30', end: '18:00' },
    },
    sunday: {
      closed: true,
      morning: { enabled: false, start: '00:00', end: '00:00' },
      afternoon: { enabled: false, start: '00:00', end: '00:00' },
    },
  },
  services: {
    categoriesEnabled: false,
  },
  qrSticker: null,
};
