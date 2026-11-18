import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordRecoveryForm from './PasswordRecoveryForm';
import PasswordResetForm from './PasswordResetForm';
import AuthPage from '@/pages/AuthPage';

const mocks = vi.hoisted(() => ({
  auth: {
    forgotPassword: vi.fn(), inspectPasswordReset: vi.fn(), resetPassword: vi.fn(), logout: vi.fn(),
    login: vi.fn(), loginWithGoogle: vi.fn(), loginWithMicrosoft: vi.fn(), signup: vi.fn(),
    isAuthenticated: false, user: null as null | { id: string; isLocalAdmin: boolean },
  },
  tenant: { isPlatform: false, brand: { id: 'brand-a' }, config: { branding: { shortName: 'Salón de prueba' } } },
  localId: 'local-a',
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: mocks.tenant, currentLocationId: mocks.localId }) }));
vi.mock('@/hooks/useI18n', async () => {
  const { translateUi } = await import('@/lib/i18n');
  const t = (key: string, values?: Record<string, string | number>) => translateUi({ language: 'es', defaultLanguage: 'es', key, values });
  return { useI18n: () => ({ t, language: 'es' }) };
});
vi.mock('@/hooks/useSiteSettings', async () => {
  const { DEFAULT_SITE_SETTINGS } = await import('@/data/salonInfo');
  return { useSiteSettings: () => ({ settings: DEFAULT_SITE_SETTINGS }) };
});
vi.mock('@/components/layout/LegalFooter', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.isAuthenticated = false;
  mocks.auth.user = null;
  mocks.tenant.isPlatform = false;
  mocks.localId = 'local-a';
  mocks.auth.forgotPassword.mockResolvedValue({ success: true });
  mocks.auth.inspectPasswordReset.mockResolvedValue({ success: true });
  mocks.auth.resetPassword.mockResolvedValue({ success: true });
  mocks.auth.logout.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const fillPasswords = (password = 'Passw0rd!') => {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), { target: { value: password } });
};
const resetProps = () => ({ code: 'one-use-code', onLogin: vi.fn(), onRequestLink: vi.fn(), onConsumed: vi.fn() });
const LocationProbe = () => { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; };
const PageHarness = ({ path = '/auth' }: { path?: string }) => <MemoryRouter initialEntries={[path]}><LocationProbe /><Routes>
  <Route path="/auth" element={<AuthPage />} /><Route path="*" element={<p>redirected</p>} />
</Routes></MemoryRouter>;
const renderPage = (path = '/auth') => render(<PageHarness path={path} />);

describe('recovery request form', () => {
  it('focuses the heading, reuses email and provides an accessible return action', () => {
    const onBack = vi.fn();
    render(<PasswordRecoveryForm initialEmail="customer@example.com" onBack={onBack} />);
    expect(screen.getByRole('heading', { name: 'Recupera tu contraseña' })).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveValue('customer@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(onBack).toHaveBeenCalledWith('customer@example.com');
  });
  it('validates email before requesting recovery', () => {
    render(<PasswordRecoveryForm initialEmail="not-an-email" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Introduce un email válido.');
    expect(mocks.auth.forgotPassword).not.toHaveBeenCalled();
  });
  it('shows a neutral success with spam guidance and a 60-second resend cooldown', async () => {
    vi.useFakeTimers();
    render(<PasswordRecoveryForm initialEmail="Customer@Example.com" onBack={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' })));
    expect(mocks.auth.forgotPassword).toHaveBeenCalledExactlyOnceWith('customer@example.com');
    expect(screen.getByRole('status')).toHaveTextContent('Si customer@example.com corresponde');
    expect(screen.getByRole('status')).toHaveTextContent('spam');
    expect(screen.getByRole('button', { name: 'Podrás reenviar en 60 s' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('button', { name: 'Volver a enviar enlace' })).toBeEnabled();
  });
  it('prevents duplicate submits and preserves email after a provider error', async () => {
    let finish!: (value: { success: boolean; error: string }) => void;
    mocks.auth.forgotPassword.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<PasswordRecoveryForm initialEmail="customer@example.com" onBack={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Enviar enlace de recuperación' });
    fireEvent.submit(submit.closest('form')!);
    fireEvent.submit(submit.closest('form')!);
    expect(mocks.auth.forgotPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviando solicitud...' })).toBeDisabled();
    await act(async () => finish({ success: false, error: 'Error de conexión. Reintenta.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Error de conexión. Reintenta.');
    expect(screen.getByLabelText('Email')).toHaveValue('customer@example.com');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar enlace de recuperación' })).toBeEnabled();
  });
  it('handles unexpected errors without displaying raw provider details', async () => {
    mocks.auth.forgotPassword.mockRejectedValue(new Error('secret-provider-error'));
    render(<PasswordRecoveryForm initialEmail="customer@example.com" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido completar la solicitud.');
    expect(screen.queryByText('secret-provider-error')).not.toBeInTheDocument();
  });
});

describe('password reset form', () => {
  it('waits for code validation before asking for a password', async () => {
    render(<PasswordResetForm {...resetProps()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando el enlace');
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Nueva contraseña')).toHaveAttribute('autocomplete', 'new-password');
  });
  it('requires matching passwords, preserving them and allowing accessible reveal', async () => {
    render(<PasswordResetForm {...resetProps()} />);
    await screen.findByLabelText('Nueva contraseña');
    fillPasswords();
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(mocks.auth.resetPassword).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseñas' }));
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseñas' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('keeps the password draft after network or policy errors', async () => {
    mocks.auth.resetPassword.mockResolvedValue({ success: false, error: 'Se requieren 12 caracteres.' });
    render(<PasswordResetForm {...resetProps()} />);
    await screen.findByLabelText('Nueva contraseña');
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('12 caracteres');
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('Passw0rd!');
  });
  it('shows terminal link errors with a request-new-link action', async () => {
    mocks.auth.inspectPasswordReset.mockResolvedValue({ success: false, invalidLink: true, error: 'El enlace ha caducado.' });
    const props = resetProps();
    render(<PasswordResetForm {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar un nuevo enlace' }));
    expect(props.onRequestLink).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
  });
  it('can retry verification after a temporary failure', async () => {
    mocks.auth.inspectPasswordReset.mockResolvedValueOnce({ success: false, error: 'Sin conexión.' }).mockResolvedValueOnce({ success: true });
    render(<PasswordResetForm {...resetProps()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a comprobar el enlace' }));
    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(mocks.auth.inspectPasswordReset).toHaveBeenCalledTimes(2);
  });
  it('handles a concurrently consumed code at commit without showing success', async () => {
    mocks.auth.resetPassword.mockResolvedValue({ success: false, invalidLink: true, error: 'Enlace utilizado.' });
    render(<PasswordResetForm {...resetProps()} />);
    await screen.findByLabelText('Nueva contraseña');
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByRole('button', { name: 'Solicitar un nuevo enlace' })).toBeInTheDocument();
    expect(screen.queryByText('Contraseña actualizada')).not.toBeInTheDocument();
  });
  it('prevents duplicate commits, removes password fields after success, and explicitly returns to login', async () => {
    let finish!: (value: { success: boolean }) => void;
    mocks.auth.resetPassword.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const props = resetProps();
    render(<PasswordResetForm {...props} />);
    await screen.findByLabelText('Nueva contraseña');
    fillPasswords();
    const form = screen.getByRole('button', { name: 'Guardar nueva contraseña' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mocks.auth.resetPassword).toHaveBeenCalledExactlyOnceWith('one-use-code', 'Passw0rd!');
    await act(async () => finish({ success: true }));
    expect(screen.getByRole('heading', { name: 'Contraseña actualizada' })).toHaveFocus();
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    expect(props.onConsumed).toHaveBeenCalledOnce();
    expect(props.onLogin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(props.onLogin).toHaveBeenCalledOnce();
  });
  it('reports logout errors instead of silently leaving the success view', async () => {
    const props = { ...resetProps(), onLogin: vi.fn().mockRejectedValue(new Error('session error')) };
    render(<PasswordResetForm {...props} />);
    await screen.findByLabelText('Nueva contraseña');
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    await screen.findByText('Contraseña actualizada');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cerrar la sesión anterior');
    expect(screen.getByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument();
  });
});

describe('tenant /auth integration', () => {
  it('opens recovery from login, retains the email and clears the old password on return', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'customer@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'forgotten' } });
    fireEvent.click(screen.getByRole('button', { name: '¿Has olvidado tu contraseña?' }));
    expect(screen.getByLabelText('Email')).toHaveValue('customer@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('customer@example.com');
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
  });
  it('offers recovery on Platform without exposing signup', () => {
    mocks.tenant.isPlatform = true;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '¿Has olvidado tu contraseña?' }));
    expect(screen.getByRole('heading', { name: 'Recupera tu contraseña' })).toBeInTheDocument();
    expect(screen.queryByText('Registrarse')).not.toBeInTheDocument();
  });
  it('does not redirect an authenticated user away from a reset action', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-a', isLocalAdmin: true };
    renderPage('/auth?mode=resetPassword&oobCode=one-use-code');
    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.queryByText('redirected')).not.toBeInTheDocument();
  });
  it('cleans consumed tokens from the URL and stays on the success screen', async () => {
    renderPage('/auth?mode=resetPassword&oobCode=one-use-code');
    await screen.findByLabelText('Nueva contraseña');
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/auth?tab=login');
    expect(screen.getByTestId('location')).not.toHaveTextContent('one-use-code');
    expect(mocks.auth.inspectPasswordReset).toHaveBeenCalledOnce();
  });
  it('does not carry the recovery draft into a different location', () => {
    const view = renderPage('/auth?tab=recover');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'private@example.com' } });
    mocks.localId = 'local-b';
    view.rerender(<PageHarness path="/auth?tab=recover" />);
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });
});
