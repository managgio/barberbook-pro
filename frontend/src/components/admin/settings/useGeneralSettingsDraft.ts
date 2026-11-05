import { useEffect, useState, type SetStateAction } from 'react';
import type { SiteSettings } from '@/data/types';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { normalizePhoneParts } from '@/lib/siteSettings';
import { mergeSettingsDraft, settingsWithDraftPhone } from '@/lib/settingsSections';

type DraftState = {
  scope: object;
  draft: SiteSettings;
  baseline: SiteSettings;
  phoneNumber: string;
};

const createDraft = (scope: object, source?: SiteSettings): DraftState => {
  const settings = structuredClone(source ?? DEFAULT_SITE_SETTINGS);
  return { scope, draft: settings, baseline: settings, phoneNumber: normalizePhoneParts(settings.contact.phone).number };
};

const mergeServerSettings = (current: DraftState, previous: SiteSettings, next: SiteSettings): DraftState => {
  const draftWithPhone = settingsWithDraftPhone(current.draft, current.phoneNumber);
  const phoneIsUnchanged = draftWithPhone.contact.phone === previous.contact.phone;
  return {
    ...current,
    draft: mergeSettingsDraft(draftWithPhone, previous, next),
    baseline: next,
    phoneNumber: phoneIsUnchanged ? normalizePhoneParts(next.contact.phone).number : current.phoneNumber,
  };
};

export const useGeneralSettingsDraft = (scope: object, source?: SiteSettings) => {
  const [state, setState] = useState(() => createDraft(scope, source));
  useEffect(() => {
    setState((current) => {
      if (current.scope !== scope) return createDraft(scope, source);
      return source ? mergeServerSettings(current, current.baseline, source) : current;
    });
  }, [scope, source]);

  const active = state.scope === scope ? state : createDraft(scope, source);
  const setSettings = (update: SetStateAction<SiteSettings>) => setState((current) =>
    current.scope === scope ? {
      ...current,
      draft: typeof update === 'function' ? update(current.draft) : update,
    } : current);
  const setPhoneNumber = (phoneNumber: string) => setState((current) =>
    current.scope === scope ? { ...current, phoneNumber } : current);
  const acceptSaved = (saved: SiteSettings, submitted: SiteSettings) => setState((current) =>
    current.scope === scope ? mergeServerSettings(current, submitted, saved) : current);

  return { settings: active.draft, baseline: active.baseline, phoneNumber: active.phoneNumber, setSettings, setPhoneNumber, acceptSaved };
};
