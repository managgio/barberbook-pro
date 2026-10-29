import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAvailableDays } from '@/data/api/appointments';
import BookingAvailabilityCalendar from './BookingAvailabilityCalendar';
import { useBookingAvailableDays } from './useBookingAvailableDays';

vi.mock('@/data/api/appointments', () => ({ getAvailableDays: vi.fn() }));
vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ language: 'es', t: (key: string) => key }),
}));
const api = vi.mocked(getAvailableDays);
const clients: QueryClient[] = [];
const dayButtons = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('aria-pressed'));
const deferred = () => {
  let resolve!: (days: string[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const onSelect = vi.fn();
function Calendar({
  localId = 'local-1',
  serviceIds = ['s1'],
  barberIds = ['b1'],
  isStaffLoading = false,
}: {
  localId?: string;
  serviceIds?: string[];
  barberIds?: string[];
  isStaffLoading?: boolean;
}) {
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 29));
  const availability = useBookingAvailableDays({
    localId,
    visibleMonth: month,
    serviceIds,
    barberIds,
    enabled: true,
    isStaffLoading,
  });
  return (
    <BookingAvailabilityCalendar
      selectedDate={selectedDate}
      visibleMonth={month}
      onMonthChange={setMonth}
      availability={availability}
      onSelectDate={(date) => {
        setSelectedDate(date);
        onSelect(date);
      }}
    />
  );
}
function setup(props: Parameters<typeof Calendar>[0] = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...render(<Calendar {...props} />, { wrapper }), client };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 12));
  api.mockReset();
  onSelect.mockReset();
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

describe('public booking availability calendar', () => {
  it('shows loading while the compatible professionals are being refreshed', async () => {
    api.mockResolvedValue(['2026-10-30']);
    const { rerender } = setup({ isStaffLoading: true });
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText('bookingWizard.step1.loadingDays')).toBeInTheDocument();
    expect(dayButtons().every((button) => button.hasAttribute('disabled'))).toBe(true);
    rerender(<Calendar isStaffLoading={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'viernes, 30 de octubre de 2026' })).toBeEnabled());
  });

  it('blocks every day while loading and enables only days confirmed by the server', async () => {
    const request = deferred();
    api.mockReturnValueOnce(request.promise);
    setup();
    expect(
      screen.getByText('bookingWizard.step1.loadingDays'),
    ).toBeInTheDocument();
    expect(
      dayButtons().every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'bookingWizard.step1.nextMonth' }),
    ).toBeEnabled();
    request.resolve(['2026-10-30', '2026-11-01']);
    await waitFor(() =>
      expect(
        dayButtons().filter((button) => !button.hasAttribute('disabled')),
      ).toHaveLength(2),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'viernes, 30 de octubre de 2026' }),
    );
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 30));
    fireEvent.click(
      screen.getByRole('button', { name: 'jueves, 29 de octubre de 2026' }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith(
      '2026-09-28',
      '2026-11-01',
      ['b1'],
      ['s1'],
      expect.any(AbortSignal),
    );
  });

  it('blocks the next month immediately and ignores cancelled requests during rapid navigation', async () => {
    const november = deferred();
    const december = deferred();
    api
      .mockResolvedValueOnce(['2026-10-30'])
      .mockReturnValueOnce(november.promise)
      .mockReturnValueOnce(december.promise);
    setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'viernes, 30 de octubre de 2026' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'bookingWizard.step1.nextMonth' }),
    );
    expect(
      dayButtons().every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    const novemberSignal = api.mock.calls[1][4];
    fireEvent.click(
      screen.getByRole('button', { name: 'bookingWizard.step1.nextMonth' }),
    );
    await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
    expect(novemberSignal?.aborted).toBe(true);
    december.resolve(['2026-12-10']);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'jueves, 10 de diciembre de 2026' }),
      ).toBeEnabled(),
    );
    november.resolve(['2026-12-01']);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'martes, 1 de diciembre de 2026' }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByRole('button', { name: 'jueves, 10 de diciembre de 2026' }),
    ).toBeEnabled();
  });

  it('keeps days blocked after errors, offers retry and distinguishes an empty month', async () => {
    api.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    setup();
    await screen.findByText('bookingWizard.step1.daysError');
    expect(
      screen.queryByText('bookingWizard.step1.noAvailableDays'),
    ).not.toBeInTheDocument();
    expect(
      dayButtons().every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'bookingWizard.toast.genericRetry' }),
    );
    await screen.findByText('bookingWizard.step1.noAvailableDays');
    expect(
      screen.queryByText('bookingWizard.step1.daysError'),
    ).not.toBeInTheDocument();
  });

  it('isolates availability by local, professional and complete service selection', async () => {
    api.mockResolvedValue(['2026-10-30']);
    const { rerender } = setup();
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    rerender(
      <Calendar
        localId="local-2"
        barberIds={['b2', 'b1']}
        serviceIds={['s2', 's1']}
      />,
    );
    expect(
      dayButtons().every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[1].slice(2, 4)).toEqual([
      ['b1', 'b2'],
      ['s1', 's2'],
    ]);
    rerender(
      <Calendar
        localId="local-2"
        barberIds={['b2']}
        serviceIds={['s2', 's1']}
      />,
    );
    await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
    rerender(
      <Calendar localId="local-2" barberIds={['b2']} serviceIds={['s1']} />,
    );
    await waitFor(() => expect(api).toHaveBeenCalledTimes(4));
    expect(clients[0].getQueryCache().getAll()).toHaveLength(4);
  });

  it('blocks days during a refresh even when cached availability exists', async () => {
    const refresh = deferred();
    api
      .mockResolvedValueOnce(['2026-10-30'])
      .mockReturnValueOnce(refresh.promise);
    const { client } = setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'viernes, 30 de octubre de 2026' }),
      ).toBeEnabled(),
    );
    void client.invalidateQueries({ queryKey: ['booking-available-days'] });
    await waitFor(() =>
      expect(
        dayButtons().every((button) => button.hasAttribute('disabled')),
      ).toBe(true),
    );
    refresh.resolve(['2026-10-31']);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'sábado, 31 de octubre de 2026' }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole('button', { name: 'viernes, 30 de octubre de 2026' }),
    ).toBeDisabled();
  });

  it('does not request availability until a professional is available', () => {
    setup({ barberIds: [] });
    expect(api).not.toHaveBeenCalled();
    expect(
      dayButtons().every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
  });
});
