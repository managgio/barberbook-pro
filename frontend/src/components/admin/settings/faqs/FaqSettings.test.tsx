import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import es from '@/i18n/locales/es.json';
import { createFaq, deleteFaq, getFaqs, reorderFaqs, updateFaq } from '@/data/api/faqs';
import { ApiRequestError } from '@/lib/networkErrors';
import FaqSettings from './FaqSettings';

vi.mock('../LandingPublicationControl', () => ({ default: () => null }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentLocationId: 'local-a' }) }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => ({ t: (key: string, values: Record<string, string | number> = {}) =>
  Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), (es as Record<string, string>)[key] || key) }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/admin/InlineTranslationPopover', () => ({ default: ({ entityId, fieldKey }: { entityId: string; fieldKey: string }) => <span data-testid={`translation-${fieldKey}`}>{entityId}</span> }));
vi.mock('@/data/api/faqs', async (original) => ({ ...await original<typeof import('@/data/api/faqs')>(), getFaqs: vi.fn(), createFaq: vi.fn(), updateFaq: vi.fn(), deleteFaq: vi.fn(), reorderFaqs: vi.fn() }));

const faqs = [
  { id: 'a', question: '¿Reservas?', answer: 'Reserva online.', version: 2, position: 0 },
  { id: 'b', question: '¿Dónde?', answer: 'En el centro.', version: 1, position: 1 },
];
const clients: QueryClient[] = [];
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><FaqSettings /></QueryClientProvider>);
  return client;
};
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getFaqs).mockResolvedValue(faqs); });
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; });

describe('FAQ settings', () => {
  it('creates trimmed content and does not expose translation controls before the first save', async () => {
    vi.mocked(getFaqs).mockResolvedValue([]);
    vi.mocked(createFaq).mockResolvedValue(faqs[0]);
    mount(); const user = userEvent.setup();
    await screen.findByText('Las respuestas empiezan aquí');
    await user.click(screen.getAllByRole('button', { name: 'Añadir pregunta' })[0]);
    expect(screen.queryByTestId('translation-question')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Pregunta'), '  ¿Reservas?  ');
    await user.type(screen.getByLabelText('Respuesta'), '  Reserva online.  ');
    await user.click(screen.getByRole('button', { name: 'Guardar pregunta' }));
    await waitFor(() => expect(createFaq).toHaveBeenCalledWith({ question: '¿Reservas?', answer: 'Reserva online.' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits original content with its version and retains the draft if saving fails', async () => {
    vi.mocked(updateFaq).mockRejectedValue(new ApiRequestError('FAQ_CONFLICT', 409, 'HTTP'));
    mount(); const user = userEvent.setup();
    await screen.findByText('¿Reservas?');
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(screen.getByTestId('translation-question')).toHaveTextContent('a');
    expect(screen.getByTestId('translation-answer')).toHaveTextContent('a');
    await user.clear(screen.getByLabelText('Respuesta'));
    await user.type(screen.getByLabelText('Respuesta'), 'Respuesta actualizada');
    await user.click(screen.getByRole('button', { name: 'Guardar pregunta' }));
    await waitFor(() => expect(updateFaq).toHaveBeenCalledWith('a', 2, { question: '¿Reservas?', answer: 'Respuesta actualizada' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar pregunta' })).not.toBeDisabled());
    expect(screen.getByLabelText('Respuesta')).toHaveValue('Respuesta actualizada');
  });

  it('requires confirmation before deleting and submits the displayed version', async () => {
    vi.mocked(deleteFaq).mockResolvedValue();
    mount(); const user = userEvent.setup();
    await screen.findByText('¿Reservas?');
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    expect(deleteFaq).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/todas sus traducciones/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deleteFaq).toHaveBeenCalledWith('a', 2));
  });

  it('saves keyboard reordering atomically and rolls back on failure', async () => {
    vi.mocked(reorderFaqs).mockRejectedValue(new ApiRequestError('offline', 503, 'HTTP'));
    const client = mount();
    await screen.findByText('¿Reservas?');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Mover: ¿Reservas?' }), { key: 'ArrowDown' });
    await waitFor(() => expect(reorderFaqs).toHaveBeenCalledWith(['a', 'b'], ['b', 'a']));
    await waitFor(() => expect(client.getQueryData(['faqs', 'local-a', 'admin'])).toEqual(faqs));
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('¿Reservas?');
  });

  it('supports touch pointer dragging from the handle and cancels interrupted drags', async () => {
    vi.mocked(reorderFaqs).mockResolvedValue([faqs[1], faqs[0]]);
    mount(); await screen.findByText('¿Reservas?');
    const handle = screen.getByRole('button', { name: 'Mover: ¿Reservas?' });
    handle.setPointerCapture = vi.fn();
    screen.getAllByRole('listitem').forEach((row, index) => { row.getBoundingClientRect = () => ({ top: 100 + index * 100, height: 100 }) as DOMRect; });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 150, pointerType: 'touch' });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 250 });
    expect(screen.getAllByRole('listitem')[0].style.transform).toBe('translate3d(0, 100px, 0)');
    expect(screen.getAllByRole('listitem')[1].style.transform).toBe('translate3d(0, -100px, 0)');
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(reorderFaqs).not.toHaveBeenCalled();
    expect(screen.getAllByRole('listitem')[0].style.transform).toBe('');
    fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientY: 150, pointerType: 'touch' });
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 250 });
    fireEvent.pointerUp(handle, { pointerId: 2 });
    await waitFor(() => expect(reorderFaqs).toHaveBeenCalledWith(['a', 'b'], ['b', 'a']));
  });

  it('keeps actions at the row end without arrow buttons and Escape cancels a mouse drag', async () => {
    mount(); await screen.findByText('¿Reservas?');
    expect(screen.queryByRole('button', { name: /^(Subir|Bajar)/ })).not.toBeInTheDocument();
    const row = screen.getAllByRole('listitem')[0];
    expect(within(row.lastElementChild as HTMLElement).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(within(row.lastElementChild as HTMLElement).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    const handle = screen.getByRole('button', { name: 'Mover: ¿Reservas?' });
    handle.setPointerCapture = vi.fn();
    screen.getAllByRole('listitem').forEach((item, index) => { item.getBoundingClientRect = () => ({ top: 100 + index * 100, height: 100 }) as DOMRect; });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 150 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 250 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(reorderFaqs).not.toHaveBeenCalled();
    expect(row.style.transform).toBe('');
  });

  it('shows a retry action on load failure instead of an empty list', async () => {
    vi.mocked(getFaqs).mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar');
    expect(screen.getByRole('button', { name: 'Añadir pregunta' })).toBeDisabled();
    expect(screen.queryByText('Las respuestas empiezan aquí')).not.toBeInTheDocument();
  });
});
