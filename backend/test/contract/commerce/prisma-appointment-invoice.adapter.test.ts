import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaAppointmentInvoiceAdapter } from '@/contexts/commerce/infrastructure/prisma/prisma-appointment-invoice.adapter';

const persistedInvoice = {
  id: 'invoice-1',
  appointmentId: 'appointment-1',
  number: 'FACT-2026-000001',
  issuedAt: new Date('2026-10-17T10:00:00.000Z'),
  currency: 'EUR',
  sellerName: 'Salon SL',
  sellerTaxId: 'B12345678',
  sellerAddress: 'Calle Mayor 1',
  sellerEmail: 'hola@example.com',
  sellerPhone: '+34123456789',
  customerName: 'Client One',
  customerEmail: 'client@example.com',
  customerPhone: null,
  serviceName: 'Corte',
  serviceDate: new Date('2026-10-16T09:00:00.000Z'),
  locationName: 'Centro',
  professionalName: 'Alex',
  subtotal: 8.26,
  taxRate: 21,
  taxAmount: 1.74,
  total: 10,
  logoUrl: null,
  primaryColor: '#d4af37',
};

test('invoice adapter reuses an existing invoice with appointment and local scope', async () => {
  let invoiceWhere: unknown;
  const prisma = {
    invoice: {
      findFirst: async (args: unknown) => {
        invoiceWhere = args;
        return persistedInvoice;
      },
    },
  };
  const tenantConfig = {
    getEffectiveConfig: async () => ({ invoicing: { enabled: true } }),
  };
  const adapter = new PrismaAppointmentInvoiceAdapter(prisma as never, tenantConfig as never);

  const result = await adapter.issueForAppointment({
    brandId: 'brand-1',
    localId: 'local-1',
    timezone: 'Europe/Madrid',
    appointmentId: 'appointment-1',
    actorUserId: 'admin-1',
  });

  assert.deepEqual(invoiceWhere, {
    where: { appointmentId: 'appointment-1', localId: 'local-1' },
  });
  assert.equal(result.number, persistedInvoice.number);
  assert.equal(result.amounts.total, 10);
});

test('invoice adapter blocks issuance when Platform has not enabled the tenant feature', async () => {
  const prisma = {
    invoice: {
      findFirst: async () => {
        throw new Error('database should not be queried');
      },
    },
  };
  const tenantConfig = {
    getEffectiveConfig: async () => ({ invoicing: { enabled: false } }),
  };
  const adapter = new PrismaAppointmentInvoiceAdapter(prisma as never, tenantConfig as never);

  await assert.rejects(
    () => adapter.issueForAppointment({
      brandId: 'brand-1',
      localId: 'local-1',
      timezone: 'Europe/Madrid',
      appointmentId: 'appointment-1',
      actorUserId: 'admin-1',
    }),
    ForbiddenException,
  );
});

test('invoice adapter does not issue an invoice for an appointment outside the resolved tenant', async () => {
  let appointmentWhere: unknown;
  const transactionClient = {
    invoice: { findFirst: async () => null },
    appointment: {
      findFirst: async (args: unknown) => {
        appointmentWhere = args;
        return {
          id: 'appointment-foreign',
          local: { name: 'Foreign location', brandId: 'brand-b' },
        };
      },
    },
  };
  const prisma = {
    invoice: { findFirst: async () => null },
    $transaction: async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient),
  };
  const tenantConfig = {
    getEffectiveConfig: async () => ({ invoicing: { enabled: true } }),
  };
  const adapter = new PrismaAppointmentInvoiceAdapter(prisma as never, tenantConfig as never);

  await assert.rejects(
    () => adapter.issueForAppointment({
      brandId: 'brand-a',
      localId: 'local-a',
      timezone: 'Europe/Madrid',
      appointmentId: 'appointment-foreign',
      actorUserId: 'admin-a',
    }),
    NotFoundException,
  );
  assert.deepEqual(appointmentWhere, {
    where: { id: 'appointment-foreign', localId: 'local-a' },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      service: { select: { name: true } },
      barber: { select: { name: true } },
      local: { select: { name: true, brandId: true } },
    },
  });
});

test('invoice adapter retries a sequence collision caused by concurrent first invoices', async () => {
  let transactionAttempts = 0;
  let invoiceLookups = 0;
  const transactionClient = {
    invoice: {
      findFirst: async () => persistedInvoice,
    },
  };
  const prisma = {
    invoice: {
      findFirst: async () => {
        invoiceLookups += 1;
        return null;
      },
    },
    $transaction: async (operation: (tx: typeof transactionClient) => Promise<unknown>) => {
      transactionAttempts += 1;
      if (transactionAttempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint conflict', {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
        });
      }
      return operation(transactionClient);
    },
  };
  const tenantConfig = {
    getEffectiveConfig: async () => ({ invoicing: { enabled: true } }),
  };
  const adapter = new PrismaAppointmentInvoiceAdapter(prisma as never, tenantConfig as never);

  const result = await adapter.issueForAppointment({
    brandId: 'brand-1',
    localId: 'local-1',
    timezone: 'Europe/Madrid',
    appointmentId: 'appointment-1',
    actorUserId: 'admin-1',
  });

  assert.equal(result.number, persistedInvoice.number);
  assert.equal(transactionAttempts, 2);
  assert.equal(invoiceLookups, 2);
});
