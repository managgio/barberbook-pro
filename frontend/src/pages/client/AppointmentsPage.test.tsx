import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import AppointmentsPage from './AppointmentsPage';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useSiteSettings', () => ({
  useSiteSettings: () => ({
    settings: {
      appointments: { cancellationCutoffHours: 0 },
      branding: { name: 'Test tenant' },
      location: { label: 'Test location', mapUrl: '#' },
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ language: 'en', t: (key: string) => key }),
}));

vi.mock('@/lib/businessCopy', () => ({
  useBusinessCopy: () => ({ staff: { singular: 'Professional' } }),
}));

vi.mock('@/components/common/AppointmentEditorDialog', () => ({
  default: () => null,
}));

vi.mock('@/data/api/appointments', () => ({
  getAppointmentsByUser: async () => [
    {
      id: 'appointment-1',
      userId: 'user-1',
      barberId: 'professional-1',
      barberNameSnapshot: 'Alex',
      serviceId: 'service-1',
      serviceNameSnapshot: 'Haircut',
      startDateTime: '2099-09-02T12:15:00.000Z',
      price: 28,
      status: 'scheduled',
    },
  ],
  updateAppointment: async () => undefined,
}));

vi.mock('@/data/api/barbers', () => ({
  getBarbers: async () => [],
}));

vi.mock('@/data/api/services', () => ({
  getServices: async () => [],
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={['/app/appointments']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/app/appointments" element={<AppointmentsPage />} />
          <Route path="/app/book" element={<div>booking-destination</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('AppointmentsPage', () => {
  it('offers a direct action to book another appointment while an upcoming booking is visible', async () => {
    renderPage();

    expect(await screen.findByText('Haircut')).toBeInTheDocument();
    const bookAgainButton = screen.getByRole('button', { name: 'appointments.actions.bookAgain' });
    expect(bookAgainButton).toHaveClass('h-8', 'w-fit', 'px-3', 'text-xs', 'sm:h-11', 'sm:px-5', 'sm:text-base');
    fireEvent.click(bookAgainButton);

    expect(screen.getByText('booking-destination')).toBeInTheDocument();
  });
});
