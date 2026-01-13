import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updateAppointment } from '@/data/api';
import { Appointment, AppointmentStatus } from '@/data/types';
import { useToast } from '@/hooks/use-toast';
import {
  APPOINTMENT_STATUSES,
  getAppointmentStatusBadgeClass,
  getAppointmentStatusDotClass,
  getAppointmentStatusLabel,
} from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';

const COMPLETION_GRACE_MS = 60 * 1000;

interface AppointmentStatusPickerProps {
  appointment: Appointment;
  serviceDurationMinutes?: number;
  onStatusUpdated?: (appointment: Appointment) => void;
  className?: string;
}

const AppointmentStatusPicker: React.FC<AppointmentStatusPickerProps> = ({
  appointment,
  serviceDurationMinutes = 30,
  onStatusUpdated,
  className,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const canComplete = useMemo(() => {
    if (appointment.status === 'completed') return true;
    if (appointment.status === 'no_show' || appointment.status === 'cancelled') return false;
    const start = new Date(appointment.startDateTime);
    const endTime = new Date(start.getTime() + serviceDurationMinutes * 60 * 1000);
    return Date.now() >= endTime.getTime() + COMPLETION_GRACE_MS;
  }, [appointment.startDateTime, appointment.status, serviceDurationMinutes]);

  const isOptionDisabled = (status: AppointmentStatus) => {
    if (status === appointment.status) return true;
    if (appointment.status === 'completed' && status === 'scheduled') return true;
    if (status === 'completed' && !canComplete) return true;
    return false;
  };

  const handleSelect = async (status: AppointmentStatus) => {
    if (isSaving || isOptionDisabled(status)) return;
    setIsSaving(true);
    try {
      const updated = await updateAppointment(appointment.id, { status });
      toast({
        title: 'Estado actualizado',
        description: `La cita quedó como ${getAppointmentStatusLabel(status).toLowerCase()}.`,
      });
      onStatusUpdated?.(updated);
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de la cita.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(value) => !isSaving && setOpen(value)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
            getAppointmentStatusBadgeClass(appointment.status),
            'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
          )}
          aria-label="Cambiar estado de la cita"
          disabled={isSaving}
        >
          {getAppointmentStatusLabel(appointment.status)}
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 rounded-xl p-2 shadow-lg" align="end">
        <div className="space-y-1">
          {APPOINTMENT_STATUSES.map((status) => {
            const disabled = isOptionDisabled(status);
            const active = status === appointment.status;
            return (
              <button
                key={status}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors',
                  disabled ? 'opacity-50' : 'hover:bg-secondary/70',
                )}
                onClick={() => handleSelect(status)}
                disabled={disabled || isSaving}
              >
                <span className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', getAppointmentStatusDotClass(status))} />
                  {getAppointmentStatusLabel(status)}
                </span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AppointmentStatusPicker;
