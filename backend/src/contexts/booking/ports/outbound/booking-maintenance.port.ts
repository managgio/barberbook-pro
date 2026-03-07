export const BOOKING_MAINTENANCE_PORT = Symbol('BOOKING_MAINTENANCE_PORT');

export interface BookingMaintenancePort {
  syncStatusesForAllAppointments(): Promise<number>;
  syncStatusesForAppointments(params: { appointmentIds: string[] }): Promise<number>;
  findAppointmentsForAnonymization?(params: { localId: string; cutoff: Date }): Promise<string[]>;
  sendPaymentConfirmation(params: { appointmentId: string; localId: string }): Promise<void>;
  anonymizeAppointment(params: {
    appointmentId: string;
    actorUserId?: string | null;
    reason?: string;
  }): Promise<unknown>;
}
