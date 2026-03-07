import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');

const parseBoolEnv = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const parseCsvEnv = (name, fallback = []) => {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve(output) : reject(new Error(`${command} ${args.join(' ')} failed (${code})`)),
    );
  });

const parseSmokeDetails = (output) => {
  const details = [];
  const regex = /\[migration:smoke:details\]\s+(\{.*\})/g;
  let match = regex.exec(output);
  while (match) {
    try {
      details.push(JSON.parse(match[1]));
    } catch {
      // ignore malformed marker
    }
    match = regex.exec(output);
  }
  return details;
};

const getDetailById = (details, smokeId) => details.find((detail) => detail?.smokeId === smokeId) || null;

const validateRequiredChecks = ({ detail, smokeId, requiredChecks }) => {
  const errors = [];
  if (!detail) {
    errors.push(`Missing smoke details marker for ${smokeId}.`);
    return errors;
  }

  for (const checkName of requiredChecks) {
    const check = Array.isArray(detail.checks)
      ? detail.checks.find((item) => item?.name === checkName)
      : null;

    if (!check) {
      errors.push(`[${smokeId}] required check missing: ${checkName}`);
      continue;
    }
    if (!check.ok) {
      errors.push(`[${smokeId}] required check failed: ${checkName}`);
      continue;
    }
    if (check.skipped) {
      errors.push(`[${smokeId}] required check skipped: ${checkName} (${check.reason || 'no-reason'})`);
    }
  }

  return errors;
};

const main = async () => {
  const enabled = parseBoolEnv('TEST_E2E_SMOKE_ENABLED', false);
  const strict = parseBoolEnv('TEST_E2E_SMOKE_STRICT', false);
  const requireCheckout = parseBoolEnv('TEST_E2E_SMOKE_REQUIRE_CHECKOUT', false);

  if (!enabled) {
    console.log('E2E smoke skipped: set TEST_E2E_SMOKE_ENABLED=true to enable runtime e2e smokes.');
    return;
  }

  console.log('E2E smoke enabled. Running runtime capability + authenticated smokes.');
  await runCommand('npm', ['run', 'build']);
  await runCommand('node', ['scripts/migration/runtime-preflight.mjs']);

  const capabilityOutput = await runCommand('node', ['scripts/migration/runtime-capability-smoke.mjs']);
  const authenticatedOutput = await runCommand('node', ['scripts/migration/runtime-authenticated-smoke.mjs']);

  if (strict) {
    const capabilityDetails = parseSmokeDetails(capabilityOutput);
    const authenticatedDetails = parseSmokeDetails(authenticatedOutput);

    const requiredCapabilityChecks = parseCsvEnv('TEST_E2E_SMOKE_REQUIRED_CHECKS_CAPABILITY', [
      'tenant.bootstrap',
      'appointments.fixture.resolve',
      'appointments.availability.single.valid',
      'appointments.availability.batch.valid',
      'appointments.create.valid',
      'payments.availability',
    ]);

    const requiredAuthChecks = parseCsvEnv('TEST_E2E_SMOKE_REQUIRED_CHECKS_AUTH', [
      'auth.users.self',
      'auth.users.by-firebase.self',
      'auth.users.by-email.self',
      'auth.barbers.list',
      'auth.services.list',
      'auth.products.public',
      'auth.offers.list',
      'auth.subscriptions.me',
      'auth.payments.availability',
      'auth.loyalty.programs.active',
      'auth.referrals.my-summary',
      'auth.reviews.pending',
      'auth.admin.users.list',
      'auth.admin.barbers.list',
      'auth.admin.products.list',
      'auth.admin.subscriptions.plans',
      'auth.admin.payments.stripe.config',
      'auth.admin.loyalty.programs',
      'auth.admin.referrals.list',
      'auth.platform.metrics',
      'auth.platform.brands.list',
      'auth.platform.brand.health',
      'auth.platform.observability.web-vitals',
      'auth.platform.observability.api',
      'auth.appointments.create.valid',
      'auth.payments.webhook.invalid-body',
    ]);

    if (requireCheckout) {
      requiredCapabilityChecks.push('payments.checkout.valid');
      requiredAuthChecks.push('auth.payments.checkout.valid');
    }

    const strictErrors = [
      ...validateRequiredChecks({
        detail: getDetailById(capabilityDetails, 'runtime-capability'),
        smokeId: 'runtime-capability',
        requiredChecks: requiredCapabilityChecks,
      }),
      ...validateRequiredChecks({
        detail: getDetailById(authenticatedDetails, 'runtime-authenticated'),
        smokeId: 'runtime-authenticated',
        requiredChecks: requiredAuthChecks,
      }),
    ];

    if (strictErrors.length > 0) {
      throw new Error(`Strict E2E smoke gate failed:\n- ${strictErrors.join('\n- ')}`);
    }

    console.log(
      `Strict E2E smoke gate passed (requireCheckout=${requireCheckout ? 'true' : 'false'}).`,
    );
  }

  console.log('E2E smoke completed successfully.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
