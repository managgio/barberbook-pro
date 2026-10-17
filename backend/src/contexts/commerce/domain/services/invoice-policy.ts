const DEFAULT_TAX_RATE = 21;
const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_SERIES_PREFIX = 'FACT';

type InvoicingSettingsInput = {
  enabled?: boolean;
  taxRate?: number;
  currency?: string;
  seriesPrefix?: string;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateInvoiceTotals = (grossTotal: number, taxRate: number) => {
  const safeTotal = roundCurrency(Math.max(0, Number.isFinite(grossTotal) ? grossTotal : 0));
  const safeTaxRate = Math.min(100, Math.max(0, Number.isFinite(taxRate) ? taxRate : DEFAULT_TAX_RATE));
  const subtotal = safeTaxRate === 0
    ? safeTotal
    : roundCurrency(safeTotal / (1 + (safeTaxRate / 100)));
  return {
    subtotal,
    taxRate: safeTaxRate,
    taxAmount: roundCurrency(safeTotal - subtotal),
    total: safeTotal,
  };
};

export const resolveInvoicingSettings = (config?: InvoicingSettingsInput) => {
  const rawTaxRate = Number(config?.taxRate);
  const rawCurrency = config?.currency?.trim().toUpperCase() || '';
  const rawPrefix = config?.seriesPrefix?.trim().toUpperCase() || '';
  const seriesPrefix = rawPrefix
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12) || DEFAULT_SERIES_PREFIX;

  return {
    enabled: config?.enabled === true,
    taxRate: Number.isFinite(rawTaxRate) ? Math.min(100, Math.max(0, rawTaxRate)) : DEFAULT_TAX_RATE,
    currency: /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : DEFAULT_CURRENCY,
    seriesPrefix,
  };
};

export const buildInvoiceNumber = (seriesPrefix: string, year: number, sequence: number) =>
  `${seriesPrefix}-${year}-${Math.max(1, sequence).toString().padStart(6, '0')}`;
