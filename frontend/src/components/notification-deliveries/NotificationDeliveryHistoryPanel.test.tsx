import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NotificationDeliveryHistory } from '@/data/api/notificationDeliveries';
import { NotificationDeliveryHistoryPanel } from './NotificationDeliveryHistoryPanel';

const history: NotificationDeliveryHistory = {
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
  enabledChannels: ['email', 'sms', 'whatsapp'],
  counts: {
    pending: 0,
    processing: 0,
    accepted: 0,
    retrying: 0,
    failed: 1,
    skipped: 0,
  },
  items: [
    {
      id: 'delivery-1',
      brandId: 'brand-1',
      brandName: 'Negocio Demo',
      localId: 'local-1',
      localName: 'Centro',
      appointmentId: 'appointment-1',
      channel: 'sms',
      kind: 'reminder',
      status: 'failed',
      recipient: '*******89',
      recipientName: 'Cliente',
      title: 'Recordatorio de cita',
      attemptCount: 5,
      maxAttempts: 5,
      nextAttemptAt: null,
      providerMessageId: null,
      lastErrorCode: 'TWILIO_TEMPORARY_FAILURE',
      lastErrorMessage: 'Twilio temporarily rejected the SMS request.',
      acceptedAt: null,
      failedAt: '2026-08-29T10:00:00.000Z',
      skippedAt: null,
      createdAt: '2026-08-29T09:55:00.000Z',
      attempts: [],
    },
  ],
};

describe('NotificationDeliveryHistoryPanel', () => {
  it('shows multichannel tenant context, safe diagnostics and retry actions', () => {
    const onRetry = vi.fn();
    render(
      <NotificationDeliveryHistoryPanel
        data={history}
        filters={{ status: 'all', kind: 'all', channel: 'all', brandId: 'all', localId: 'all' }}
        brandOptions={[{ value: 'all', label: 'Todos' }, { value: 'brand-1', label: 'Negocio Demo' }]}
        localOptions={[{ value: 'all', label: 'Todos' }, { value: 'local-1', label: 'Centro' }]}
        showTenant
        canRetry
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getAllByText('Negocio Demo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Centro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TWILIO_TEMPORARY_FAILURE').length).toBeGreaterThan(0);
    expect(screen.getByText(/aceptados se conservan temporalmente/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\*+89/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Filtrar por método').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    expect(onRetry).toHaveBeenCalledWith('delivery-1');
  });
});
