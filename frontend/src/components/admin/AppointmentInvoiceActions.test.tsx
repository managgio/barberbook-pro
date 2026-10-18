import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppointmentInvoiceActions from './AppointmentInvoiceActions';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: { config: { invoicing: { enabled: true } } } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ language: 'es', t: (key: string) => key }),
}));

afterEach(cleanup);

describe('AppointmentInvoiceActions', () => {
  it('shows the invoice action when Platform enabled invoicing for the tenant', () => {
    render(<AppointmentInvoiceActions appointmentId="appointment-1" status="completed" compact />);
    expect(screen.getByRole('button', { name: 'admin.invoices.action' })).toBeInTheDocument();
  });

  it.each(['cancelled', 'no_show'] as const)('hides the invoice action for %s appointments', (status) => {
    render(<AppointmentInvoiceActions appointmentId="appointment-1" status={status} compact />);
    expect(screen.queryByRole('button', { name: 'admin.invoices.action' })).not.toBeInTheDocument();
  });
});
