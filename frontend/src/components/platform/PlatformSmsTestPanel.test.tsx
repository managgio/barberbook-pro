import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PlatformSmsTestPanel from './PlatformSmsTestPanel';
import { isLocalDevelopmentHostname } from './platformSmsTest';

const sendPlatformTestSmsMock = vi.fn();
const toastMock = vi.fn();

vi.mock('@/data/api/platform', () => ({
  sendPlatformTestSms: (...args: unknown[]) => sendPlatformTestSmsMock(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => (
      values ? `${key}:${Object.values(values).join(':')}` : key
    ),
  }),
}));

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformSmsTestPanel />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  sendPlatformTestSmsMock.mockReset();
  toastMock.mockReset();
});

describe('PlatformSmsTestPanel', () => {
  it('recognizes only loopback and localhost development hosts', () => {
    expect(isLocalDevelopmentHostname('localhost')).toBe(true);
    expect(isLocalDevelopmentHostname('platform.localhost')).toBe(true);
    expect(isLocalDevelopmentHostname('127.0.0.1')).toBe(true);
    expect(isLocalDevelopmentHostname('platform.managgio.com')).toBe(false);
  });

  it('sends a test only after a plausible phone has been provided', async () => {
    sendPlatformTestSmsMock.mockResolvedValueOnce({
      success: true,
      providerMessageId: 'SM_test',
      actualSender: 'MANAGGIO',
      senderMatchesExpected: true,
    });
    renderPanel();

    const sendButton = screen.getByRole('button', { name: 'platform.smsTest.send' });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('platform.smsTest.phone'), {
      target: { value: '+34 600 000 000' },
    });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendPlatformTestSmsMock).toHaveBeenCalledWith({
        phone: '+34 600 000 000',
        message: 'MANAGGIO: recordatorio SMS de prueba.',
      });
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'platform.smsTest.successTitle',
    }));
  });

  it('warns when the provider selected a sender other than MANAGGIO', async () => {
    sendPlatformTestSmsMock.mockResolvedValueOnce({
      success: true,
      providerMessageId: 'SM_test',
      actualSender: '+34910000000',
      senderMatchesExpected: false,
    });
    renderPanel();

    fireEvent.change(screen.getByLabelText('platform.smsTest.phone'), {
      target: { value: '+34 600 000 000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'platform.smsTest.send' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'platform.smsTest.senderMismatchTitle',
        variant: 'destructive',
      }));
    });
  });

  it('does not report sender validation when the provider omits the actual sender', async () => {
    sendPlatformTestSmsMock.mockResolvedValueOnce({ success: true, providerMessageId: 'SM_test' });
    renderPanel();

    fireEvent.change(screen.getByLabelText('platform.smsTest.phone'), {
      target: { value: '+34 600 000 000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'platform.smsTest.send' }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'platform.smsTest.senderUnverifiedTitle',
        variant: 'destructive',
      }));
    });
  });

  it('shows an accessible validation message for malformed phones', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText('platform.smsTest.phone'), {
      target: { value: '123' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('platform.smsTest.phoneInvalid');
    expect(screen.getByRole('button', { name: 'platform.smsTest.send' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('platform.smsTest.phone'), {
      target: { value: '+00000000' },
    });
    expect(screen.getByRole('button', { name: 'platform.smsTest.send' })).toBeDisabled();
  });

  it('shows the encoding and blocks messages above the three-segment limit', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText('platform.smsTest.phone'), {
      target: { value: '+34 600 000 000' },
    });
    fireEvent.change(screen.getByLabelText('platform.smsTest.message'), {
      target: { value: 'á'.repeat(202) },
    });

    expect(screen.getByText('platform.smsTest.segmentation:UCS-2:4:3')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('platform.smsTest.segmentLimitExceeded:3');
    expect(screen.getByRole('button', { name: 'platform.smsTest.send' })).toBeDisabled();
  });
});
