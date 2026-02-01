const STORAGE_KEY = 'managgio.referralAttribution';

type StoredReferralAttribution = {
  id: string;
  expiresAt: string;
  code?: string;
};

export const storeReferralAttribution = (data: StoredReferralAttribution) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getStoredReferralAttribution = (): StoredReferralAttribution | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredReferralAttribution;
    if (parsed?.expiresAt) {
      const expiresAt = new Date(parsed.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearStoredReferralAttribution = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};
