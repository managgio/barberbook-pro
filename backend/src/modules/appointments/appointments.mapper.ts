import { Appointment, AppointmentProduct, Product } from '@prisma/client';

type AppointmentWithProducts = Appointment & { products?: (AppointmentProduct & { product?: Product | null })[] };

export const mapAppointment = (appointment: AppointmentWithProducts) => ({
  id: appointment.id,
  userId: appointment.userId || null,
  barberId: appointment.barberId,
  barberNameSnapshot: appointment.barberNameSnapshot || null,
  serviceId: appointment.serviceId,
  serviceNameSnapshot: appointment.serviceNameSnapshot || null,
  startDateTime: appointment.startDateTime.toISOString(),
  price: Number(appointment.price),
  paymentMethod: appointment.paymentMethod || null,
  status: appointment.status,
  notes: appointment.notes || null,
  guestName: appointment.guestName || null,
  guestContact: appointment.guestContact || null,
  products: appointment.products
    ? appointment.products.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product?.name ?? '',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.unitPrice) * item.quantity,
        imageUrl: item.product?.imageUrl ?? null,
        isPublic: item.product?.isPublic ?? false,
      }))
    : undefined,
});
