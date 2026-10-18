import { describe, expect, it } from 'vitest';
import { Appointment } from '@/data/types';
import {
  getAppointmentDurationMinutes,
  getAppointmentPriceBreakdown,
  getAppointmentServiceLabel,
  getAppointmentServices,
  isMultiServiceAppointment,
} from './appointmentPresentation';

const appointment: Appointment = {
  id: 'appointment-1',
  userId: 'user-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  serviceNameSnapshot: 'Corte + Color',
  totalDurationMinutes: 90,
  services: [
    { id: 'item-2', serviceId: 'service-2', name: 'Color', durationMinutes: 60, unitPrice: 35, position: 1 },
    { id: 'item-1', serviceId: 'service-1', name: 'Corte', durationMinutes: 30, unitPrice: 20, position: 0 },
  ],
  startDateTime: '2026-10-17T10:00:00.000Z',
  price: 62,
  walletAppliedAmount: 3,
  products: [
    { id: 'product-item-1', productId: 'product-1', name: 'Champú', quantity: 1, unitPrice: 10, totalPrice: 10 },
  ],
  status: 'scheduled',
};

describe('appointment presentation', () => {
  it('orders and describes every service in a multi-service appointment', () => {
    expect(getAppointmentServices(appointment).map((item) => item.name)).toEqual(['Corte', 'Color']);
    expect(getAppointmentServiceLabel(appointment)).toBe('Corte + Color');
    expect(getAppointmentDurationMinutes(appointment)).toBe(90);
    expect(isMultiServiceAppointment(appointment)).toBe(true);
  });

  it('reconciles services, products, wallet and adjustments with the authoritative final total', () => {
    expect(getAppointmentPriceBreakdown(appointment)).toEqual({
      servicesTotal: 55,
      productsTotal: 10,
      walletDiscount: 3,
      adjustment: 0,
      total: 62,
    });
  });

  it('falls back to the catalog service for legacy appointments', () => {
    const legacy = { ...appointment, services: undefined, serviceNameSnapshot: null, totalDurationMinutes: undefined };
    const service = { id: 'service-1', name: 'Corte clásico', duration: 45, price: 25 };

    expect(getAppointmentServiceLabel(legacy, service)).toBe('Corte clásico');
    expect(getAppointmentDurationMinutes(legacy, service)).toBe(45);
    expect(getAppointmentPriceBreakdown(legacy).servicesTotal).toBeNull();
  });
});
