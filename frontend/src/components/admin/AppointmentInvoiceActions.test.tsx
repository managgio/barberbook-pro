import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppointmentInvoiceActions from './AppointmentInvoiceActions';
import { issueAppointmentInvoice } from '@/data/api/invoices';
import { downloadInvoicePdf, generateAppointmentInvoicePdf, shareInvoicePdf } from '@/lib/invoicePdf';

const theme = vi.hoisted(() => ({ mode: 'dark' as 'dark' | 'light' | undefined }));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ tenant: { config: { invoicing: { enabled: true }, theme: { mode: theme.mode } } } }),
}));

vi.mock('@/data/api/invoices', () => ({ issueAppointmentInvoice: vi.fn() }));
vi.mock('@/lib/invoicePdf', () => ({
  generateAppointmentInvoicePdf: vi.fn(), downloadInvoicePdf: vi.fn(), shareInvoicePdf: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ language: 'es', t: (key: string) => key }),
}));

beforeEach(() => { vi.clearAllMocks(); theme.mode = 'dark'; });
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

  it.each([
    ['dark', 'download', 'dark'],
    ['dark', 'share', 'dark'],
    ['light', 'download', 'light'],
    ['light', 'share', 'light'],
    [undefined, 'download', 'dark'],
  ] as const)('uses the tenant theme %s for %s', async (mode, action, expectedMode) => {
    theme.mode = mode;
    const invoice = { number: 'FACT-2026-000042' } as Awaited<ReturnType<typeof issueAppointmentInvoice>>;
    const result = { blob: new Blob(['pdf']), fileName: 'factura.pdf' };
    vi.mocked(issueAppointmentInvoice).mockResolvedValue(invoice);
    vi.mocked(generateAppointmentInvoicePdf).mockResolvedValue(result);
    vi.mocked(shareInvoicePdf).mockResolvedValue('shared');
    render(<AppointmentInvoiceActions appointmentId="appointment-1" status="completed" />);
    await userEvent.click(screen.getByRole('button', { name: 'admin.invoices.action' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: `admin.invoices.${action}` }));
    await waitFor(() => expect(generateAppointmentInvoicePdf).toHaveBeenCalledWith(invoice, 'es', expectedMode));
    expect(issueAppointmentInvoice).toHaveBeenCalledWith('appointment-1');
    if (action === 'download') expect(downloadInvoicePdf).toHaveBeenCalledWith(result);
    else expect(shareInvoicePdf).toHaveBeenCalledWith(result, 'admin.invoices.shareTitle');
  });
});
