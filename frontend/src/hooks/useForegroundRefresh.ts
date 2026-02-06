import { useEffect, useRef } from 'react';

export const useForegroundRefresh = (onRefresh: () => void, enabled = true) => {
  const onRefreshRef = useRef(onRefresh);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const triggerRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < 750) return;
      lastRefreshAtRef.current = now;
      onRefreshRef.current();
    };

    const handleFocus = () => {
      triggerRefresh();
    };

    const handleVisibility = () => {
      if (document.hidden) return;
      triggerRefresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled]);
};
