import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentInvoice } from '@/data/types';
import { buildInvoiceFileName, generateAppointmentInvoicePdf } from './invoicePdf';

const pdf = vi.hoisted(() => ({
  setFillColor: vi.fn(), rect: vi.fn(), roundedRect: vi.fn(), addImage: vi.fn(),
  setTextColor: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(), text: vi.fn(),
  setDrawColor: vi.fn(), line: vi.fn(), splitTextToSize: vi.fn((text: string) => [text]),
  output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
}));
vi.mock('jspdf', () => ({ jsPDF: class { constructor() { Object.assign(this, pdf); } } }));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

const invoice: AppointmentInvoice = {
  id: 'invoice-1', appointmentId: 'appointment-1', number: 'FACT-2026-000042',
  issuedAt: '2026-10-18T12:00:00.000Z', currency: 'EUR',
  seller: { name: 'Salón de prueba', taxId: 'TEST', address: 'Dirección de prueba', email: null, phone: null },
  customer: { name: 'Cliente de prueba', email: null, phone: null },
  service: { name: 'Corte', date: '2026-10-18T10:00:00.000Z', locationName: 'Local', professionalName: 'Profesional' },
  amounts: { subtotal: 20, taxRate: 21, taxAmount: 4.2, total: 24.2 },
  branding: { logoUrl: 'https://example.test/logo.png', primaryColor: '#76544b' },
};

let imageSize = { width: 400, height: 100 };
beforeEach(() => {
  vi.clearAllMocks();
  imageSize = { width: 400, height: 100 };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['logo']) }));
  vi.stubGlobal('Image', class {
    naturalWidth = imageSize.width;
    naturalHeight = imageSize.height;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('invoicePdf', () => {
  it('builds a stable filesystem-safe invoice filename', () => {
    expect(buildInvoiceFileName('FACT-2026-000042')).toBe('factura-fact-2026-000042.pdf');
    expect(buildInvoiceFileName('Serie Á / 1')).toBe('factura-serie-a-1.pdf');
  });

  it.each([[400, 100], [100, 100], [100, 400], [800, 40]])(
    'centers a %ix%i logo with padding over a rounded dark background without distortion',
    async (width, height) => {
      imageSize = { width, height };
      await generateAppointmentInvoicePdf(invoice, 'es', 'dark');
      expect(pdf.setFillColor).toHaveBeenCalledWith(10, 10, 10);
      const [x, y, frameWidth, frameHeight, radiusX, radiusY, fill] = pdf.roundedRect.mock.calls[0];
      const [, , imageX, imageY, imageWidth, imageHeight] = pdf.addImage.mock.calls[0];
      expect([radiusX, radiusY, fill]).toEqual([3, 3, 'F']);
      expect(imageWidth / imageHeight).toBeCloseTo(width / height);
      expect(imageX - x).toBeGreaterThanOrEqual(4);
      expect(imageY - y).toBeGreaterThanOrEqual(4);
      expect(imageX + imageWidth / 2).toBeCloseTo(x + frameWidth / 2);
      expect(imageY + imageHeight / 2).toBeCloseTo(y + frameHeight / 2);
      expect(y + frameHeight).toBeLessThan(48);
      expect(pdf.roundedRect.mock.invocationCallOrder[0]).toBeLessThan(pdf.addImage.mock.invocationCallOrder[0]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logo');
    },
  );

  it('keeps light-theme logos on the white page', async () => {
    await generateAppointmentInvoicePdf(invoice, 'es', 'light');
    expect(pdf.setFillColor).not.toHaveBeenCalledWith(10, 10, 10);
    expect(pdf.addImage).toHaveBeenCalledWith(expect.any(String), 'PNG', 16, 16, 42, 10.5, undefined, 'FAST');
  });

  it('keeps the initials fallback without a dark background when the logo is missing', async () => {
    await generateAppointmentInvoicePdf({ ...invoice, branding: { ...invoice.branding, logoUrl: null } }, 'es', 'dark');
    expect(fetch).not.toHaveBeenCalled();
    expect(pdf.addImage).not.toHaveBeenCalled();
    expect(pdf.setFillColor).not.toHaveBeenCalledWith(10, 10, 10);
    expect(pdf.text).toHaveBeenCalledWith('SA', expect.any(Number), expect.any(Number), { align: 'center' });
  });

  it('still generates the invoice if the logo cannot be fetched', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Logo unavailable'));
    const result = await generateAppointmentInvoicePdf(invoice, 'es', 'dark');
    expect(result.blob.type).toBe('application/pdf');
    expect(pdf.addImage).not.toHaveBeenCalled();
    expect(pdf.setFillColor).not.toHaveBeenCalledWith(10, 10, 10);
  });

  it('clears the dark background before rendering initials if PDF image embedding fails', async () => {
    pdf.addImage.mockImplementationOnce(() => { throw new Error('Invalid image'); });
    await generateAppointmentInvoicePdf(invoice, 'es', 'dark');
    expect(pdf.rect).toHaveBeenCalledWith(16, 14, 50, 28, 'F');
    expect(pdf.text).toHaveBeenCalledWith('SA', expect.any(Number), expect.any(Number), { align: 'center' });
  });
});
