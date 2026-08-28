import * as assert from 'node:assert/strict';
import { setImmediate as waitForImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import {
  PlatformWebVitalName,
  PlatformWebVitalRating,
} from '@/contexts/platform/domain/entities/platform-observability.entity';
import { InMemoryPrismaPlatformObservabilityAdapter } from '@/modules/observability/adapters/in-memory-prisma-platform-observability.adapter';

test('web vital adapter emails only critical events, resolves tenant names, and applies tenant-level cooldown', async () => {
  const emails: Array<{ subject: string; lines: string[] }> = [];
  const tenantLookups: Array<Record<string, unknown>> = [];
  const prisma = {
    location: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        tenantLookups.push(args.where);
        return {
          name: 'Centro',
          brand: {
            name: 'Le Blond',
            _count: { locations: 2 },
          },
        };
      },
    },
  };
  const adapter = new InMemoryPrismaPlatformObservabilityAdapter(prisma as never, {} as never);
  const mutableAdapter = adapter as unknown as {
    sendAlertEmail: (email: { subject: string; lines: string[] }) => Promise<void>;
  };
  mutableAdapter.sendAlertEmail = async (email) => {
    emails.push(email);
  };
  const context = {
    brandId: 'brand-1',
    localId: 'local-1',
    userAgent: 'Browser test',
  };

  adapter.recordWebVital({
    name: PlatformWebVitalName.LCP,
    value: 5_000,
    rating: PlatformWebVitalRating.POOR,
    path: '/app/book',
  }, context);
  await waitForImmediate();
  assert.equal(emails.length, 0);

  adapter.recordWebVital({
    name: PlatformWebVitalName.LCP,
    value: 12_000,
    rating: PlatformWebVitalRating.POOR,
    path: '/app/book',
  }, context);
  await waitForImmediate();
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /Le Blond · Centro/);
  assert.deepEqual(tenantLookups, [{ id: 'local-1', brandId: 'brand-1' }]);

  adapter.recordWebVital({
    name: PlatformWebVitalName.LCP,
    value: 13_000,
    rating: PlatformWebVitalRating.POOR,
    path: '/app/appointments',
  }, context);
  await waitForImmediate();
  assert.equal(emails.length, 1);
});
