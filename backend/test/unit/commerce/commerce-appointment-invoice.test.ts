import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { IssueAppointmentInvoiceUseCase } from '@/contexts/commerce/application/use-cases/issue-appointment-invoice.use-case';
import {
  buildInvoiceNumber,
  calculateInvoiceTotals,
  resolveInvoicingSettings,
} from '@/contexts/commerce/domain/services/invoice-policy';
import type { CommerceAppointmentInvoicePort } from '@/contexts/commerce/ports/outbound/appointment-invoice.port';

test('invoice totals split a VAT-inclusive appointment price without losing cents', () => {
  assert.deepEqual(calculateInvoiceTotals(50, 21), {
    subtotal: 41.32,
    taxRate: 21,
    taxAmount: 8.68,
    total: 50,
  });
  assert.deepEqual(calculateInvoiceTotals(10, 0), {
    subtotal: 10,
    taxRate: 0,
    taxAmount: 0,
    total: 10,
  });
});

test('invoice settings are safe by default and sanitize the document series', () => {
  assert.deepEqual(resolveInvoicingSettings(undefined), {
    enabled: false,
    taxRate: 21,
    currency: 'EUR',
    seriesPrefix: 'FACT',
  });
  assert.deepEqual(resolveInvoicingSettings({
    enabled: true,
    taxRate: 10,
    currency: 'eur',
    seriesPrefix: ' salón / 01 ',
  }), {
    enabled: true,
    taxRate: 10,
    currency: 'EUR',
    seriesPrefix: 'SALON01',
  });
  assert.equal(buildInvoiceNumber('FAC', 2026, 42), 'FAC-2026-000042');
});

test('issue appointment invoice use case propagates tenant scope and actor', async () => {
  let received: Parameters<CommerceAppointmentInvoicePort['issueForAppointment']>[0] | null = null;
  const port: CommerceAppointmentInvoicePort = {
    issueForAppointment: async (params) => {
      received = params;
      return {} as never;
    },
  };
  const useCase = new IssueAppointmentInvoiceUseCase(port);
  await useCase.execute({
    context: {
      tenantId: 'brand-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: 'admin-1',
      timezone: 'Europe/Madrid',
      correlationId: 'correlation-1',
    },
    appointmentId: 'appointment-1',
    actorUserId: 'admin-1',
  });

  assert.deepEqual(received, {
    brandId: 'brand-1',
    localId: 'local-1',
    timezone: 'Europe/Madrid',
    appointmentId: 'appointment-1',
    actorUserId: 'admin-1',
  });
});
