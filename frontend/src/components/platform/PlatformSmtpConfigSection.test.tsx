import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlatformSmtpConfigSection from './PlatformSmtpConfigSection';

const verifyMock = vi.fn();
const toastMock = vi.fn();

vi.mock('@/data/api/platform', () => ({
  verifyPlatformBrandEmailConfig: (...args: unknown[]) => verifyMock(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${values.host}:${values.port}` : key,
  }),
}));

const renderSection = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformSmtpConfigSection
        brandId="brand-ronin"
        config={{
          user: 'sender@gmail.com',
          passwordConfigured: true,
          host: 'smtp.gmail.com',
          port: 587,
          fromName: 'Ronin',
        }}
        onChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
};

describe('PlatformSmtpConfigSection', () => {
  it('does not render a persisted secret and verifies using the server-side password', async () => {
    verifyMock.mockResolvedValueOnce({
      ok: true,
      code: 'SMTP_CONNECTION_OK',
      message: 'ok',
      endpoint: { host: 'smtp.gmail.com', port: 587, user: 's***@gmail.com', secure: false },
    });
    renderSection();

    const password = screen.getByLabelText('platform.smtp.password');
    expect(password).toHaveValue('');
    expect(password).toHaveAttribute('placeholder', 'platform.smtp.passwordConfigured');

    fireEvent.click(screen.getByRole('button', { name: 'platform.smtp.verify' }));

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledWith('brand-ronin', {
        user: 'sender@gmail.com',
        password: '',
        host: 'smtp.gmail.com',
        port: 587,
      });
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'default' }));
  });
});
