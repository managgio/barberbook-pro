import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuestAppointmentAccessSummary } from '@/data/api/guestAppointmentAccess';
import { ApiRequestError } from '@/lib/networkErrors';

import GuestAppointmentManagePage from './GuestAppointmentManagePage';

const getGuestAppointmentAccessMock = vi.fn();
const cancelGuestAppointmentMock = vi.fn();

vi.mock('@/data/api/guestAppointmentAccess', () => ({
  getGuestAppointmentAccess: (...args: unknown[]) => getGuestAppointmentAccessMock(...args),
  cancelGuestAppointment: (...args: unknown[]) => cancelGuestAppointmentMock(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    tenant: {
      brand: { name: 'Demo Studio' },
      config: { branding: { shortName: 'Demo' } },
    },
  }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    language: 'en-GB',
    t: (key: string, values?: Record<string, string | number>) => (
      values ? `${key}:${Object.values(values).join(':')}` : key
    ),
  }),
}));

const scheduledSummary: GuestAppointmentAccessSummary = {
  status: 'scheduled',
  startDateTime: '2026-10-20T08:30:00.000Z',
  durationMinutes: 60,
  serviceName: 'Cut + Colour',
  professionalName: 'Alex',
  timezone: 'Europe/Madrid',
  canCancel: true,
  cancellationUnavailableReason: null,
};

const renderPage = (path = '/cita/secure-token') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/cita/:token" element={<GuestAppointmentManagePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  getGuestAppointmentAccessMock.mockReset();
  cancelGuestAppointmentMock.mockReset();
});

describe('GuestAppointmentManagePage', () => {
  it('shows only the safe appointment summary and offers cancellation when allowed', async () => {
    getGuestAppointmentAccessMock.mockResolvedValueOnce({
      ...scheduledSummary,
      guestName: 'Private Client',
      guestPhone: '+34600000000',
    });

    renderPage();

    expect(await screen.findByText('Cut + Colour')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('guestAppointment.status.scheduled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'guestAppointment.actions.cancel' })).toBeInTheDocument();
    expect(screen.queryByText('Private Client')).not.toBeInTheDocument();
    expect(screen.queryByText('+34600000000')).not.toBeInTheDocument();
  });

  it('requires confirmation and replaces the summary after cancellation', async () => {
    getGuestAppointmentAccessMock.mockResolvedValueOnce(scheduledSummary);
    cancelGuestAppointmentMock.mockResolvedValueOnce({
      ...scheduledSummary,
      status: 'cancelled',
      canCancel: false,
      cancellationUnavailableReason: 'already_cancelled',
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'guestAppointment.actions.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'guestAppointment.actions.confirmCancel' }));

    await waitFor(() => {
      expect(cancelGuestAppointmentMock).toHaveBeenCalledWith('secure-token');
      expect(screen.getByText('guestAppointment.status.cancelled')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'guestAppointment.actions.cancel' })).not.toBeInTheDocument();
    expect(screen.getByText('guestAppointment.cancellation.reason.already_cancelled')).toBeInTheDocument();
  });

  it('explains the cancellation cutoff without rendering a cancel action', async () => {
    getGuestAppointmentAccessMock.mockResolvedValueOnce({
      ...scheduledSummary,
      canCancel: false,
      cancellationUnavailableReason: 'cancellation_cutoff_reached',
    });
    renderPage();

    expect(await screen.findByText(
      'guestAppointment.cancellation.reason.cancellation_cutoff_reached',
    )).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'guestAppointment.actions.cancel' })).not.toBeInTheDocument();
  });

  it('refreshes the authoritative summary when cancellation loses a timing race', async () => {
    getGuestAppointmentAccessMock
      .mockResolvedValueOnce(scheduledSummary)
      .mockResolvedValueOnce({
        ...scheduledSummary,
        canCancel: false,
        cancellationUnavailableReason: 'cancellation_cutoff_reached',
      });
    cancelGuestAppointmentMock.mockRejectedValueOnce(
      new ApiRequestError('conflict', 409, 'HTTP'),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'guestAppointment.actions.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'guestAppointment.actions.confirmCancel' }));

    expect(await screen.findByText(
      'guestAppointment.cancellation.reason.cancellation_cutoff_reached',
    )).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('guestAppointment.cancellation.error');
    expect(screen.queryByRole('button', { name: 'guestAppointment.actions.cancel' })).not.toBeInTheDocument();
  });

  it('uses one privacy-preserving state for invalid and expired links', async () => {
    getGuestAppointmentAccessMock.mockRejectedValueOnce(
      new ApiRequestError('not found', 404, 'HTTP'),
    );
    renderPage();

    expect(await screen.findByText('guestAppointment.error.invalid.title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'guestAppointment.actions.retry' })).not.toBeInTheDocument();
  });
});
