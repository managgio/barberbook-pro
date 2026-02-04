export const ADMIN_EVENTS = {
  appointmentsUpdated: 'admin:appointments-updated',
  holidaysUpdated: 'admin:holidays-updated',
  alertsUpdated: 'admin:alerts-updated',
  servicesUpdated: 'admin:services-updated',
  barbersUpdated: 'admin:barbers-updated',
  schedulesUpdated: 'admin:schedules-updated',
} as const;

export const dispatchAppointmentsUpdated = (detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.appointmentsUpdated, { detail }));
};

export const dispatchHolidaysUpdated = (detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.holidaysUpdated, { detail }));
};

export const dispatchAlertsUpdated = (detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.alertsUpdated, { detail }));
};

export const dispatchServicesUpdated = (detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.servicesUpdated, { detail }));
};

export const dispatchBarbersUpdated = (detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.barbersUpdated, { detail }));
};

export const dispatchSchedulesUpdated = (detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_EVENTS.schedulesUpdated, { detail }));
};
