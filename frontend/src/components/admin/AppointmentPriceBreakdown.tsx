import React from 'react';
import { Appointment } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';
import { getAppointmentPriceBreakdown } from '@/lib/appointmentPresentation';
import { cn } from '@/lib/utils';

type Props = {
  appointment: Appointment;
  className?: string;
  showTotal?: boolean;
};

const AppointmentPriceBreakdown: React.FC<Props> = ({ appointment, className, showTotal = true }) => {
  const { t, language } = useI18n();
  const breakdown = getAppointmentPriceBreakdown(appointment);
  const currencyFormatter = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
  });
  const showAdjustment = Math.abs(breakdown.adjustment) >= 0.01;
  const hasBreakdown = (breakdown.servicesTotal !== null
    && (appointment.services?.length ?? 0) > 1)
    || breakdown.productsTotal > 0
    || breakdown.walletDiscount > 0
    || showAdjustment;

  if (!hasBreakdown) return null;

  return (
    <div className={cn('space-y-1 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm', className)}>
      {breakdown.servicesTotal !== null && (
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{t('admin.appointmentServices.servicesSubtotal')}</span>
          <span className="tabular-nums">{currencyFormatter.format(breakdown.servicesTotal)}</span>
        </div>
      )}
      {breakdown.productsTotal > 0 && (
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{t('admin.appointmentServices.productsSubtotal')}</span>
          <span className="tabular-nums">+ {currencyFormatter.format(breakdown.productsTotal)}</span>
        </div>
      )}
      {breakdown.walletDiscount > 0 && (
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{t('admin.appointmentServices.walletDiscount')}</span>
          <span className="tabular-nums">- {currencyFormatter.format(breakdown.walletDiscount)}</span>
        </div>
      )}
      {showAdjustment && (
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{t('admin.appointmentServices.adjustments')}</span>
          <span className="tabular-nums">
            {breakdown.adjustment > 0 ? '+ ' : '- '}
            {currencyFormatter.format(Math.abs(breakdown.adjustment))}
          </span>
        </div>
      )}
      {showTotal && (
        <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-1.5 font-semibold text-foreground">
          <span>{t('admin.appointmentServices.appointmentTotal')}</span>
          <span className="tabular-nums text-primary">{currencyFormatter.format(breakdown.total)}</span>
        </div>
      )}
    </div>
  );
};

export default AppointmentPriceBreakdown;
