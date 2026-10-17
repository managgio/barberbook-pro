import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('AppointmentInvoiceActions', () => {
  it('shows the invoice action when Platform enabled invoicing for the tenant', () => {
    render(<AppointmentInvoiceActions appointmentId="appointment-1" compact />);
    expect(screen.getByRole('button', { name: 'admin.invoices.action' })).toBeInTheDocument();
  });
});
