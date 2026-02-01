import { Appointment, AppointmentProduct, Product } from '@prisma/client';

type AppointmentWithProducts = Appointment & { products?: (AppointmentProduct & { product?: Product | null })[] };

export const mapAppointment = (appointment: AppointmentWithProducts) => ({
  id: appointment.id,
  userId: appointment.userId || null,
  barberId: appointment.barberId,
  barberNameSnapshot: appointment.barberNameSnapshot || null,
  serviceId: appointment.serviceId,
  serviceNameSnapshot: appointment.serviceNameSnapshot || null,
  loyaltyProgramId: appointment.loyaltyProgramId || null,
  loyaltyRewardApplied: appointment.loyaltyRewardApplied ?? false,
  referralAttributionId: appointment.referralAttributionId || null,
  appliedCouponId: appointment.appliedCouponId || null,
  walletAppliedAmount: Number(appointment.walletAppliedAmount ?? 0),
  startDateTime: appointment.startDateTime.toISOString(),
  price: Number(appointment.price),
  paymentMethod: appointment.paymentMethod || null,
  paymentStatus: appointment.paymentStatus || null,
  paymentAmount: appointment.paymentAmount ? Number(appointment.paymentAmount) : null,
  paymentCurrency: appointment.paymentCurrency || null,
  paymentPaidAt: appointment.paymentPaidAt ? appointment.paymentPaidAt.toISOString() : null,
  paymentExpiresAt: appointment.paymentExpiresAt ? appointment.paymentExpiresAt.toISOString() : null,
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
