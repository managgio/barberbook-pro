import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NotificationDeliveryHistory } from '@/data/api/notificationDeliveries';
import { NotificationDeliveryHistoryPanel } from './NotificationDeliveryHistoryPanel';

afterEach(cleanup);

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
    sent: 0,
    delivered: 0,
    undelivered: 0,
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
      canRetry: true,
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
      sentAt: null,
      deliveredAt: null,
      undeliveredAt: null,
      deliveryStatusUpdatedAt: null,
      failedAt: '2026-08-29T10:00:00.000Z',
      skippedAt: null,
      createdAt: '2026-08-29T09:55:00.000Z',
      attempts: [],
    },
  ],
};

const skippedHistory: NotificationDeliveryHistory = {
  ...history,
  counts: {
    pending: 0,
    processing: 0,
    accepted: 0,
    sent: 0,
    delivered: 0,
    undelivered: 0,
    retrying: 0,
    failed: 0,
    skipped: 1,
  },
  items: [
    {
      ...history.items[0],
      id: 'delivery-skipped',
      channel: 'email',
      kind: 'appointment_created',
      status: 'skipped',
      canRetry: false,
      attemptCount: 1,
      maxAttempts: 5,
      lastErrorCode: 'EMAIL_RECIPIENT_MISSING',
      lastErrorMessage: 'No recipient email is available.',
      failedAt: null,
      skippedAt: '2026-08-29T10:00:00.000Z',
      attempts: [
        {
          id: 'attempt-skipped',
          attemptNumber: 1,
          status: 'skipped',
          providerMessageId: null,
          errorCode: 'EMAIL_RECIPIENT_MISSING',
          errorMessage: 'No recipient email is available.',
          occurredAt: '2026-08-29T10:00:00.000Z',
        },
      ],
    },
  ],
};

describe('NotificationDeliveryHistoryPanel', () => {
  it('shows multichannel tenant context, safe diagnostics and retry actions', () => {
    const onRetry = vi.fn();
    render(
      <NotificationDeliveryHistoryPanel
        data={history}
        filters={{ status: 'all', kind: 'all', channel: 'all', brandId: 'all', localId: 'all', includeResolved: false }}
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
    expect(screen.getByText(/distingue entre solicitudes aceptadas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\*+89/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Filtrar por método').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    expect(onRetry).toHaveBeenCalledWith('delivery-1');
  });

  it('marks skipped deliveries as final and hides pointless missing-recipient retries', () => {
    render(
      <NotificationDeliveryHistoryPanel
        data={skippedHistory}
        filters={{ status: 'all', kind: 'all', channel: 'all', brandId: 'all', localId: 'all', includeResolved: false }}
        canRetry
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getAllByText('No requiere reintentos').length).toBeGreaterThan(0);
    expect(screen.queryByText('1 de 5')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('does not offer a manual retry when the backend classifies an SMS failure as permanent', () => {
    render(
      <NotificationDeliveryHistoryPanel
        data={{
          ...history,
          items: [{
            ...history.items[0],
            canRetry: false,
            lastErrorCode: 'SMS_RECIPIENT_OPTED_OUT',
            lastErrorMessage: 'The recipient has opted out of SMS messages.',
          }],
        }}
        filters={{ status: 'all', kind: 'all', channel: 'all', brandId: 'all', localId: 'all', includeResolved: false }}
        canRetry
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
        onRefresh={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getAllByText('SMS_RECIPIENT_OPTED_OUT').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('requests the complete delivery history when resolved deliveries are enabled', () => {
    const onFilterChange = vi.fn();
    const onPageChange = vi.fn();
    render(
      <NotificationDeliveryHistoryPanel
        data={history}
        filters={{ status: 'all', kind: 'all', channel: 'all', brandId: 'all', localId: 'all', includeResolved: false }}
        onFilterChange={onFilterChange}
        onPageChange={onPageChange}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Incluir entregas resueltas' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onFilterChange).toHaveBeenCalledWith('includeResolved', true);
  });
});
