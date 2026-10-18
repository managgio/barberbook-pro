import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';

const backendRoot = resolve(__dirname, '../../..');
const runBootstrap = (overrides: NodeJS.ProcessEnv = {}) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'managgio-tenant-bootstrap-'));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(TENANT_|DEFAULT_BRAND|DEFAULT_LOCAL|PLATFORM_|NODE_ENV$)/.test(key)) delete env[key];
  }
  writeFileSync(resolve(directory, '.env'), [
    'NODE_ENV=development',
    'TENANT_BASE_DOMAIN=localhost',
    'TENANT_REQUIRE_SUBDOMAIN=true',
    'TENANT_ALLOW_HEADER_OVERRIDES=false',
    'TENANT_TRUST_X_FORWARDED_HOST=false',
    'DEFAULT_BRAND_ID=fixture-brand',
    'DEFAULT_LOCAL_ID=fixture-local',
    'PLATFORM_SUBDOMAIN=platform',
    'PLATFORM_ADMIN_EMAILS=platform@example.test',
  ].join('\n'));
  try {
    const result = spawnSync(process.execPath, [
      '-r', require.resolve('ts-node/register/transpile-only'),
      '-e', `
        require(${JSON.stringify(resolve(backendRoot, 'src/app.module.ts'))});
        const constants = require(${JSON.stringify(resolve(backendRoot, 'src/tenancy/tenant.constants.ts'))});
        const { TenantService } = require(${JSON.stringify(resolve(backendRoot, 'src/tenancy/tenant.service.ts'))});
        const { TenantMiddleware } = require(${JSON.stringify(resolve(backendRoot, 'src/tenancy/tenant.middleware.ts'))});
        const { getTenantContext } = require(${JSON.stringify(resolve(backendRoot, 'src/tenancy/tenant.context.ts'))});
        const prisma = {
          brand: {
            findFirst: async ({where}) => where.subdomain === 'salon' ? {id:'salon-brand', defaultLocationId:'salon-local'} : null,
            findUnique: async () => ({id:'fixture-brand', defaultLocationId:'fixture-local'}),
          },
          location: {findFirst: async ({where}) => ({id:where.id, timezone:'Europe/Madrid'})},
        };
        const middleware = new TenantMiddleware(new TenantService(prisma));
        async function request(subdomain) {
          let context;
          let status = 200;
          const response = { status(code) {status = code; return this;}, json(body) {context = body;} };
          await middleware.use({originalUrl:'/api/tenant/bootstrap', query:{}, headers:{
            host:'localhost:3000',
            'x-forwarded-host':subdomain + '.' + constants.TENANT_BASE_DOMAIN + ':8080',
          }}, response, () => {context = getTenantContext();});
          return {status, context};
        }
        Promise.all(['platform','salon','missing'].map(request)).then(([platform,salon,missing]) => {
          console.log(JSON.stringify({
            baseDomain: constants.TENANT_BASE_DOMAIN,
            requireSubdomain: constants.TENANT_REQUIRE_SUBDOMAIN,
            allowHeaderOverrides: constants.TENANT_ALLOW_HEADER_OVERRIDES,
            adminEmails: constants.PLATFORM_ADMIN_EMAILS,
            platform, salon, missing,
          }));
        }).catch(error => {console.error(error); process.exitCode = 1;});
      `,
    ], {
      cwd: directory,
      env: { ...env, ...overrides, TS_NODE_PROJECT: resolve(backendRoot, 'tsconfig.json') },
      encoding: 'utf8', timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim().split('\n').at(-1) || '{}');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test('app bootstrap loads local tenant configuration before importing business modules', () => {
  const result = runBootstrap();
  assert.equal(result.baseDomain, 'localhost');
  assert.equal(result.requireSubdomain, true);
  assert.equal(result.allowHeaderOverrides, false);
  assert.deepEqual(result.adminEmails, ['platform@example.test']);
  assert.equal(result.platform.status, 200);
  assert.equal(result.platform.context.isPlatform, true);
  assert.equal(result.platform.context.subdomain, 'platform');
  assert.equal(result.salon.context.isPlatform, false);
  assert.equal(result.salon.context.brandId, 'salon-brand');
  assert.equal(result.salon.context.localId, 'salon-local');
  assert.equal(result.missing.status, 404);
  assert.equal(result.missing.context.message, 'TENANT_NOT_FOUND');
});

test('app bootstrap preserves deployed environment values ahead of the local env file', () => {
  const result = runBootstrap({ TENANT_BASE_DOMAIN: 'customers.example.test', NODE_ENV: 'production' });
  assert.equal(result.baseDomain, 'customers.example.test');
  assert.equal(result.platform.context.isPlatform, true);
  assert.equal(result.salon.context.brandId, 'salon-brand');
  assert.equal(result.missing.status, 404);
});
