import { Appointment } from '@prisma/client';

export const mapAppointment = (appointment: Appointment) => ({
  id: appointment.id,
  userId: appointment.userId || null,
  barberId: appointment.barberId,
  serviceId: appointment.serviceId,
  startDateTime: appointment.startDateTime.toISOString(),
  price: Number(appointment.price),
  paymentMethod: appointment.paymentMethod || null,
  status: appointment.status,
  notes: appointment.notes || null,
  guestName: appointment.guestName || null,
  guestContact: appointment.guestContact || null,
});
