import { useEffect } from 'react';

export const useForegroundRefresh = (onRefresh: () => void, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleFocus = () => {
      onRefresh();
    };

    const handleVisibility = () => {
      if (document.hidden) return;
      onRefresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, onRefresh]);
};
