import type { CommerceAppointmentInvoice } from '../../domain/entities/appointment-invoice.entity';

export const COMMERCE_APPOINTMENT_INVOICE_PORT = Symbol('COMMERCE_APPOINTMENT_INVOICE_PORT');

export interface CommerceAppointmentInvoicePort {
  issueForAppointment(params: {
    brandId: string;
    localId: string;
    timezone: string;
    appointmentId: string;
    actorUserId: string | null;
  }): Promise<CommerceAppointmentInvoice>;
}
