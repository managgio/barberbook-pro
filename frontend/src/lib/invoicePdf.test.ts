import { describe, expect, it } from 'vitest';
import { buildInvoiceFileName } from './invoicePdf';

describe('invoicePdf', () => {
  it('builds a stable filesystem-safe invoice filename', () => {
    expect(buildInvoiceFileName('FACT-2026-000042')).toBe('factura-fact-2026-000042.pdf');
    expect(buildInvoiceFileName('Serie Á / 1')).toBe('factura-serie-a-1.pdf');
  });
});
