import React from 'react';
import { Appointment, Service } from '@/data/types';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/hooks/useI18n';
import {
  getAppointmentDurationMinutes,
  getAppointmentServiceLabel,
  getAppointmentServices,
  isMultiServiceAppointment,
} from '@/lib/appointmentPresentation';
import { cn } from '@/lib/utils';

type Props = {
  appointment: Appointment;
  fallbackService?: Service | null;
  showPrices?: boolean;
  className?: string;
  compact?: boolean;
};

const AppointmentServiceSummary: React.FC<Props> = ({
  appointment,
  fallbackService,
  showPrices = false,
  className,
  compact = false,
}) => {
  const { t, language } = useI18n();
  const services = getAppointmentServices(appointment, fallbackService);
  const isMultiple = isMultiServiceAppointment(appointment);
  const currencyFormatter = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('font-medium text-foreground', compact && 'text-sm')}>
          {getAppointmentServiceLabel(appointment, fallbackService) || t('admin.common.table.service')}
        </span>
        {isMultiple && (
          <Badge variant="secondary" className="h-5 px-2 text-[10px]">
            {t('admin.appointmentServices.count', { count: services.length })}
          </Badge>
        )}
      </div>

      {isMultiple && (
        <div className={cn('space-y-1 border-l-2 border-primary/25 pl-2', compact && 'text-xs')}>
          {services.map((service, index) => (
            <div key={service.id} className="flex min-w-0 items-baseline justify-between gap-3 text-muted-foreground">
              <span className="min-w-0 truncate">
                {index + 1}. {service.name} · {t('admin.appointmentServices.minutes', { minutes: service.durationMinutes })}
              </span>
              {showPrices && service.unitPrice !== null && (
                <span className="shrink-0 tabular-nums">{currencyFormatter.format(service.unitPrice)}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {isMultiple
          ? t('admin.appointmentServices.continuousBlock', {
              minutes: getAppointmentDurationMinutes(appointment, fallbackService),
            })
          : t('admin.appointmentServices.duration', {
              minutes: getAppointmentDurationMinutes(appointment, fallbackService),
            })}
      </p>
    </div>
  );
};

export default AppointmentServiceSummary;
