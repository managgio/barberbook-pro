import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import {
  PlatformAuditLogEntry,
  PlatformAuditLogManagementPort,
} from '@/contexts/platform/ports/outbound/platform-audit-log-management.port';

const baseRow: PlatformAuditLogEntry = {
  id: 'log-1',
  brandId: 'brand-1',
  locationId: 'loc-1',
  actorUserId: 'user-1',
  action: 'entity.updated',
  entityType: 'entity',
  entityId: 'entity-1',
  metadata: { source: 'test' },
  createdAt: new Date('2026-03-07T10:00:00.000Z'),
  actorUser: { id: 'user-1', name: 'Admin', email: 'admin@test.com' },
};

const basePort = (): PlatformAuditLogManagementPort => ({
  log: async () => baseRow,
  list: async () => [baseRow],
});

test('audit logs facade delegates log', async () => {
  const calls: Array<{ action: string; entityType: string }> = [];
  const service = new AuditLogsService({
    ...basePort(),
    log: async (params) => {
      calls.push({ action: params.action, entityType: params.entityType });
      return baseRow;
    },
  });

  const result = await service.log({
    action: 'appointment.completed',
    entityType: 'appointment',
    entityId: 'apt-1',
    metadata: { amount: 20 },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'appointment.completed');
  assert.equal(calls[0].entityType, 'appointment');
  assert.equal((result as PlatformAuditLogEntry).id, baseRow.id);
});

test('audit logs facade delegates list', async () => {
  const calls: Array<{ brandId?: string; action?: string }> = [];
  const service = new AuditLogsService({
    ...basePort(),
    list: async (params) => {
      calls.push({ brandId: params.brandId, action: params.action });
      return [baseRow];
    },
  });

  const result = await service.list({
    brandId: 'brand-1',
    action: 'entity.updated',
    from: '2026-03-01',
    to: '2026-03-07',
    localId: 'loc-1',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].brandId, 'brand-1');
  assert.equal(calls[0].action, 'entity.updated');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, baseRow.id);
});
