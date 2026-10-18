import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261017223000_add_sms_delivery_receipts_and_remove_tenant_twilio/migration.sql',
  ),
  'utf8',
);

test('global SMS migration removes legacy Twilio credentials from every location config', () => {
  assert.match(
    migrationSql,
    /UPDATE\s+`LocationConfig`\s+SET\s+`data`\s*=\s*JSON_REMOVE\(`data`,\s*'\$\.twilio'\)\s+WHERE\s+JSON_CONTAINS_PATH\(`data`,\s*'one',\s*'\$\.twilio'\)\s*=\s*1;/i,
  );
});

test('global SMS migration removes legacy Twilio credentials at both configuration scopes', () => {
  const twilioPathsRemoved = migrationSql.match(/JSON_REMOVE\(`data`,\s*'\$\.twilio'\)/gi) || [];

  assert.equal(twilioPathsRemoved.length, 2);
  assert.match(migrationSql, /UPDATE\s+`BrandConfig`[\s\S]*?'\$\.twilio'/i);
  assert.match(migrationSql, /UPDATE\s+`LocationConfig`[\s\S]*?'\$\.twilio'/i);
});
