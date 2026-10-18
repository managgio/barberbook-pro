import { Appointment, Service } from '@/data/types';

export type AppointmentServicePresentationItem = {
  id: string;
  serviceId: string;
  name: string;
  durationMinutes: number;
  unitPrice: number | null;
  position: number;
};

export type AppointmentPriceBreakdown = {
  servicesTotal: number | null;
  productsTotal: number;
  walletDiscount: number;
  adjustment: number;
  total: number;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getAppointmentServices = (
  appointment: Appointment,
  fallbackService?: Pick<Service, 'id' | 'name' | 'duration' | 'price' | 'finalPrice'> | null,
): AppointmentServicePresentationItem[] => {
  if (appointment.services?.length) {
    return [...appointment.services]
      .sort((left, right) => left.position - right.position)
      .map((item) => ({
        id: item.id,
        serviceId: item.serviceId,
        name: item.name,
        durationMinutes: item.durationMinutes,
        unitPrice: item.unitPrice,
        position: item.position,
      }));
  }

  return [{
    id: appointment.serviceId,
    serviceId: appointment.serviceId,
    name: appointment.serviceNameSnapshot || fallbackService?.name || '',
    durationMinutes: appointment.totalDurationMinutes ?? fallbackService?.duration ?? 30,
    unitPrice: null,
    position: 0,
  }];
};

export const getAppointmentServiceLabel = (
  appointment: Appointment,
  fallbackService?: Pick<Service, 'id' | 'name' | 'duration' | 'price' | 'finalPrice'> | null,
) => {
  const items = getAppointmentServices(appointment, fallbackService);
  const itemNames = items.map((item) => item.name.trim()).filter(Boolean);
  return appointment.serviceNameSnapshot?.trim() || itemNames.join(' + ') || fallbackService?.name || '';
};

export const getAppointmentDurationMinutes = (
  appointment: Appointment,
  fallbackService?: Pick<Service, 'id' | 'name' | 'duration' | 'price' | 'finalPrice'> | null,
) => appointment.totalDurationMinutes
  ?? getAppointmentServices(appointment, fallbackService).reduce((total, item) => total + item.durationMinutes, 0)
  ?? fallbackService?.duration
  ?? 30;

export const isMultiServiceAppointment = (appointment: Appointment) =>
  (appointment.services?.length ?? 0) > 1;

export const getAppointmentPriceBreakdown = (appointment: Appointment): AppointmentPriceBreakdown => {
  const servicesTotal = appointment.services?.length
    ? roundCurrency(appointment.services.reduce((total, item) => total + item.unitPrice, 0))
    : null;
  const productsTotal = roundCurrency(
    (appointment.products || []).reduce((total, item) => total + item.totalPrice, 0),
  );
  const walletDiscount = roundCurrency(appointment.walletAppliedAmount ?? 0);
  const total = roundCurrency(appointment.price ?? 0);
  const knownSubtotal = (servicesTotal ?? total - productsTotal + walletDiscount) + productsTotal - walletDiscount;

  return {
    servicesTotal,
    productsTotal,
    walletDiscount,
    adjustment: roundCurrency(total - knownSubtotal),
    total,
  };
};
