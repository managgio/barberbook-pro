import React, { useEffect, useState } from 'react';
import { getActiveAlerts } from '@/data/api/alerts';
import { Alert } from '@/data/types';
import { Info, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const AlertBanner: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAlerts = async () => {
      const data = await getActiveAlerts();
      setAlerts(data);
    };
    fetchAlerts();
  }, []);

  const dismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  if (visibleAlerts.length === 0) return null;

  const icons = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
  };

  const styles = {
    info: 'bg-primary/10 border-primary/30 text-primary',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
    success: 'bg-green-500/10 border-green-500/30 text-green-500',
  };

  return (
    <div className="space-y-2 mb-6">
      {visibleAlerts.map((alert) => {
        const Icon = icons[alert.type];
        return (
          <div
            key={alert.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border animate-slide-up',
              styles[alert.type]
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{alert.title}</p>
              <p className="text-sm opacity-80">{alert.message}</p>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="p-1 hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AlertBanner;
