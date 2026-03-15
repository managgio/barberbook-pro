import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';

const NetworkStatusMonitor: React.FC = () => {
  const wasOfflineRef = useRef(false);
  const { t } = useI18n();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const notifyOffline = () => {
      wasOfflineRef.current = true;
      toast({
        title: t('networkStatus.toast.offlineTitle'),
        description: t('networkStatus.toast.offlineDescription'),
        variant: 'destructive',
      });
    };

    const notifyOnline = () => {
      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;
      toast({
        title: t('networkStatus.toast.onlineTitle'),
        description: t('networkStatus.toast.onlineDescription'),
      });
    };

    if (!navigator.onLine) {
      notifyOffline();
    }

    window.addEventListener('offline', notifyOffline);
    window.addEventListener('online', notifyOnline);
    return () => {
      window.removeEventListener('offline', notifyOffline);
      window.removeEventListener('online', notifyOnline);
    };
  }, [t]);

  return null;
};

export default NetworkStatusMonitor;
