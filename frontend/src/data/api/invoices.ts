import type { AppointmentInvoice } from '@/data/types';
import { apiRequest } from './request';

export const issueAppointmentInvoice = (appointmentId: string): Promise<AppointmentInvoice> =>
  apiRequest(`/invoices/appointments/${appointmentId}`, { method: 'POST' });
