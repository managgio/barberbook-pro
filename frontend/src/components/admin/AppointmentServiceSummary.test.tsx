import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Appointment } from '@/data/types';
import AppointmentPriceBreakdown from './AppointmentPriceBreakdown';
import AppointmentServiceSummary from './AppointmentServiceSummary';

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    language: 'es',
    t: (key: string, values?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'admin.appointmentServices.count': '{count} servicios',
        'admin.appointmentServices.minutes': '{minutes} min',
        'admin.appointmentServices.continuousBlock': 'Bloque continuo de {minutes} min',
        'admin.appointmentServices.duration': 'Duración: {minutes} min',
        'admin.appointmentServices.servicesSubtotal': 'Servicios',
        'admin.appointmentServices.productsSubtotal': 'Productos',
        'admin.appointmentServices.walletDiscount': 'Saldo utilizado',
        'admin.appointmentServices.adjustments': 'Ajustes y descuentos',
        'admin.appointmentServices.appointmentTotal': 'Total de la cita',
      };
      return Object.entries(values || {}).reduce(
        (message, [name, value]) => message.replace(`{${name}}`, String(value)),
        translations[key] || key,
      );
    },
  }),
}));

const appointment: Appointment = {
  id: 'appointment-1',
  userId: 'user-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  serviceNameSnapshot: 'Corte + Color',
  totalDurationMinutes: 90,
  services: [
    { id: 'item-1', serviceId: 'service-1', name: 'Corte', durationMinutes: 30, unitPrice: 20, position: 0 },
    { id: 'item-2', serviceId: 'service-2', name: 'Color', durationMinutes: 60, unitPrice: 35, position: 1 },
  ],
  startDateTime: '2026-10-17T10:00:00.000Z',
  price: 62,
  walletAppliedAmount: 3,
  products: [
    { id: 'product-item-1', productId: 'product-1', name: 'Champú', quantity: 1, unitPrice: 10, totalPrice: 10 },
  ],
  status: 'scheduled',
};

afterEach(cleanup);

describe('admin multi-service appointment presentation', () => {
  it('explains the ordered services and their continuous total duration', () => {
    render(<AppointmentServiceSummary appointment={appointment} showPrices />);

    expect(screen.getByText('Corte + Color')).toBeInTheDocument();
    expect(screen.getByText('2 servicios')).toBeInTheDocument();
    expect(screen.getByText('1. Corte · 30 min')).toBeInTheDocument();
    expect(screen.getByText('2. Color · 60 min')).toBeInTheDocument();
    expect(screen.getByText('Bloque continuo de 90 min')).toBeInTheDocument();
  });

  it('reconciles all lines with one authoritative appointment total', () => {
    render(<AppointmentPriceBreakdown appointment={appointment} />);

    expect(screen.getByText('Servicios')).toBeInTheDocument();
    expect(screen.getByText('Productos')).toBeInTheDocument();
    expect(screen.getByText('Saldo utilizado')).toBeInTheDocument();
    expect(screen.getByText('Total de la cita')).toBeInTheDocument();
    expect(screen.getByText(/62,00/)).toBeInTheDocument();
  });
});
