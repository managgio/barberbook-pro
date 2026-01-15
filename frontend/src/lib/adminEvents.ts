export const ADMIN_EVENTS = {
  appointmentsUpdated: 'admin:appointments-updated',
  holidaysUpdated: 'admin:holidays-updated',
  alertsUpdated: 'admin:alerts-updated',
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
