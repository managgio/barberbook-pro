import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  canonicalizeIanaTimeZone,
  resolveLocationTimeZone,
} from '@/contexts/platform/domain/services/location-timezone.policy';
import { AlsTenantContextAdapter } from '@/contexts/platform/infrastructure/adapters/als-tenant-context.adapter';
import { AlsTenantContextRunnerAdapter } from '@/contexts/platform/infrastructure/adapters/als-tenant-context-runner.adapter';
import { CreateLocationDto } from '@/modules/platform-admin/dto/create-location.dto';
import { UpdateLocationDto } from '@/modules/platform-admin/dto/update-location.dto';
import { APP_TIMEZONE } from '@/utils/timezone';

test('location timezone policy canonicalizes valid IANA zones and rejects malformed values', () => {
  assert.equal(canonicalizeIanaTimeZone(' Europe/Madrid '), 'Europe/Madrid');
  assert.equal(canonicalizeIanaTimeZone('Atlantic/Canary'), 'Atlantic/Canary');
  assert.equal(canonicalizeIanaTimeZone('Madrid'), null);
  assert.equal(resolveLocationTimeZone('invalid/timezone', APP_TIMEZONE), APP_TIMEZONE);
});

test('location DTOs validate timezone through the shared IANA policy', async () => {
  const createDto = plainToInstance(CreateLocationDto, {
    name: 'Local Canarias',
    timezone: ' Atlantic/Canary ',
  });
  const validErrors = await validate(createDto);
  assert.equal(validErrors.length, 0);
  assert.equal(createDto.timezone, 'Atlantic/Canary');

  const updateDto = plainToInstance(UpdateLocationDto, { timezone: 'not-a-timezone' });
  const invalidErrors = await validate(updateDto);
  assert.equal(invalidErrors.length, 1);
  assert.equal(invalidErrors[0].property, 'timezone');
});

test('ALS runner propagates the local timezone into request context', async () => {
  const runner = new AlsTenantContextRunnerAdapter();
  const contextAdapter = new AlsTenantContextAdapter();

  await runner.runWithContext(
    {
      brandId: 'brand-1',
      localId: 'local-1',
      timezone: 'Atlantic/Canary',
    },
    async () => {
      const context = contextAdapter.getRequestContext({ correlationId: 'corr-timezone' });
      assert.equal(context.timezone, 'Atlantic/Canary');
      assert.equal(context.brandId, 'brand-1');
      assert.equal(context.localId, 'local-1');
    },
  );
});
