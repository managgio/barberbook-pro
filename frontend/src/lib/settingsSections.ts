import type { SiteSettings } from '@/data/types';
import { composePhone } from '@/lib/siteSettings';

export type GeneralSettingsSection = 'identity' | 'operations';
export const SETTINGS_PHONE_PREFIX = '+34';

export const settingsWithDraftPhone = (settings: SiteSettings, phoneNumber: string): SiteSettings => ({
  ...settings,
  contact: {
    ...settings.contact,
    phone: phoneNumber.replace(/\D/g, '') ? composePhone(SETTINGS_PHONE_PREFIX, phoneNumber) : '',
  },
});

export const buildSettingsSectionPayload = (
  saved: SiteSettings,
  draft: SiteSettings,
  section: GeneralSettingsSection,
): SiteSettings => section === 'identity' ? {
  ...saved,
  branding: draft.branding,
  location: draft.location,
  contact: draft.contact,
  socials: Object.fromEntries(Object.entries(draft.socials).map(([key, value]) => [key, value?.trim() || ''])) as SiteSettings['socials'],
  stats: draft.stats,
} : {
  ...saved,
  appointments: draft.appointments,
  profile: draft.profile,
  products: {
    ...saved.products,
    clientPurchaseEnabled: draft.products.clientPurchaseEnabled,
    showOnLanding: draft.products.showOnLanding,
  },
};

export const mergeSettingsDraft = (
  draft: SiteSettings,
  previousSaved: SiteSettings,
  nextSaved: SiteSettings,
): SiteSettings => ({
  ...nextSaved,
  ...Object.fromEntries((Object.keys(draft) as (keyof SiteSettings)[])
    .filter((key) => JSON.stringify(draft[key]) !== JSON.stringify(previousSaved[key]))
    .map((key) => [key, draft[key]])),
});
