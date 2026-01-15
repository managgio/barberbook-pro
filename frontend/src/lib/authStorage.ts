const ADMIN_USER_KEY = 'managgio.adminUserId';

export const getAdminUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ADMIN_USER_KEY);
};

export const setAdminUserId = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  if (!userId) {
    window.localStorage.removeItem(ADMIN_USER_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_USER_KEY, userId);
};
