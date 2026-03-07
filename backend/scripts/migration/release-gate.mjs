import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const nodeBin = process.execPath;

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCheckList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const parseSmokeSummary = (stdout) => {
  const lines = String(stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const summaryPrefix = '[migration:smoke:summary] ';
  const summaryLine = [...lines].reverse().find((line) => line.startsWith(summaryPrefix));
  if (!summaryLine) return null;

  const payload = summaryLine.slice(summaryPrefix.length);
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const checkDefinitions = {
  runtime: {
    title: 'runtime capability smoke',
    script: ['scripts/migration/runtime-capability-smoke.mjs'],
  },
  auth: {
    title: 'authenticated runtime smoke',
    script: ['scripts/migration/runtime-authenticated-smoke.mjs'],
  },
  parity: {
    title: 'runtime parity smoke (legacy mode retired; check may SKIP)',
    script: ['scripts/migration/runtime-parity-smoke.mjs'],
  },
};

const ciGuardChecks = [
  {
    key: 'arch',
    title: 'architecture boundaries',
    command: nodeBin,
    args: ['scripts/check-architecture-boundaries.mjs'],
  },
  {
    key: 'transition-artifacts',
    title: 'transition artifacts enforce-zero',
    command: nodeBin,
    args: ['scripts/migration/generate-transition-artifacts-checklist.mjs', '--check', '--require-zero-present'],
  },
  {
    key: 'context-module-bridges',
    title: 'context-module bridges enforce-zero',
    command: nodeBin,
    args: ['scripts/migration/generate-context-module-bridges-inventory.mjs', '--check', '--require-zero-present'],
  },
];

const profileDefaults = {
  staging: {
    enabled: true,
    checks: ['runtime', 'auth'],
    minPassRate: 1,
    maxFailedChecks: 0,
    requireStripeCheckoutCoverage: false,
    includeCiGuards: true,
  },
  canary: {
    enabled: true,
    checks: ['runtime', 'auth'],
    minPassRate: 1,
    maxFailedChecks: 0,
    requireStripeCheckoutCoverage: true,
    includeCiGuards: true,
  },
  prod: {
    enabled: true,
    checks: ['runtime', 'auth'],
    minPassRate: 1,
    maxFailedChecks: 0,
    requireStripeCheckoutCoverage: true,
    includeCiGuards: true,
  },
};

const runCheck = async (key, definition, extraEnv = {}) => {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(nodeBin, definition.script, {
      cwd: backendRoot,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;
      const passed = code === 0;
      const summary = parseSmokeSummary(stdout);
      resolve({
        key,
        passed,
        code,
        signal,
        durationMs,
        stdout,
        stderr,
        summary,
      });
    });
  });
};

const runCiGuardCheck = async (definition, extraEnv = {}) => {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(definition.command, definition.args, {
      cwd: backendRoot,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;
      resolve({
        key: definition.key,
        passed: code === 0,
        code,
        signal,
        durationMs,
        stdout,
        stderr,
      });
    });
  });
};

const toBoolLikeStatus = (value) => String(value || '').trim().toUpperCase() === 'SKIP';

const main = async () => {
  const profile = String(process.env.MIGRATION_RELEASE_GATE_PROFILE || '').trim().toLowerCase();
  const profileConfig = profile ? profileDefaults[profile] : null;
  if (profile && !profileConfig) {
    throw new Error(`Unknown MIGRATION_RELEASE_GATE_PROFILE=${profile}`);
  }

  const enabled = toBool(process.env.MIGRATION_RELEASE_GATE_ENABLED, profileConfig?.enabled ?? false);
  const selectedChecks = normalizeCheckList(
    process.env.MIGRATION_RELEASE_GATE_CHECKS || (profileConfig?.checks || ['runtime', 'auth']).join(','),
  );
  const minPassRate = parseNumber(
    process.env.MIGRATION_RELEASE_GATE_MIN_PASS_RATE,
    profileConfig?.minPassRate ?? 1,
  );
  const maxFailedChecks = parseNumber(
    process.env.MIGRATION_RELEASE_GATE_MAX_FAILED_CHECKS,
    profileConfig?.maxFailedChecks ?? 0,
  );
  const requireStripeCheckoutCoverage = toBool(
    process.env.MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT,
    profileConfig?.requireStripeCheckoutCoverage ?? false,
  );
  const minCheckoutNonSkipOverride = process.env.MIGRATION_RELEASE_GATE_MIN_CHECKOUT_NON_SKIP;
  const includeCiGuards = toBool(
    process.env.MIGRATION_RELEASE_GATE_INCLUDE_CI_GUARDS,
    profileConfig?.includeCiGuards ?? true,
  );

  if (!enabled) {
    console.log('[migration:gate:release] SKIPPED (MIGRATION_RELEASE_GATE_ENABLED=false).');
    console.log('[migration:gate:release] To enforce gate, set MIGRATION_RELEASE_GATE_ENABLED=true.');
    process.exit(0);
  }

  const invalidChecks = selectedChecks.filter((check) => !checkDefinitions[check]);
  if (invalidChecks.length > 0) {
    throw new Error(`Unknown release-gate checks: ${invalidChecks.join(', ')}`);
  }

  if (selectedChecks.length === 0) {
    throw new Error('Release gate enabled but no checks selected.');
  }

  console.log('[migration:gate:release] START');
  const targetCheckoutChecks = selectedChecks.filter((check) => check === 'runtime' || check === 'auth');
  const minCheckoutNonSkip = parseNumber(
    minCheckoutNonSkipOverride,
    requireStripeCheckoutCoverage ? targetCheckoutChecks.length : 0,
  );

  console.log(
    `[migration:gate:release] config profile=${profile || 'custom'} checks=${selectedChecks.join(',')} ` +
      `minPassRate=${minPassRate} maxFailedChecks=${maxFailedChecks} ` +
      `requireStripeCheckoutCoverage=${requireStripeCheckoutCoverage} minCheckoutNonSkip=${minCheckoutNonSkip} ` +
      `includeCiGuards=${includeCiGuards}`,
  );

  if (includeCiGuards) {
    for (const guardCheck of ciGuardChecks) {
      console.log(`[migration:gate:release] running ci-guard ${guardCheck.key}: ${guardCheck.title}`);
      // eslint-disable-next-line no-await-in-loop
      const result = await runCiGuardCheck(guardCheck);
      console.log(
        `[migration:gate:release] ci-guard ${guardCheck.key} ${result.passed ? 'PASS' : 'FAIL'} ` +
          `durationMs=${result.durationMs} code=${result.code ?? 'null'} signal=${result.signal ?? 'none'}`,
      );
      if (!result.passed) {
        throw new Error(
          `[migration:gate:release] FAILED prerequisite ci-guard=${guardCheck.key} ` +
            `code=${result.code ?? 'null'} signal=${result.signal ?? 'none'}`,
        );
      }
    }
  }

  const results = [];
  for (const check of selectedChecks) {
    const definition = checkDefinitions[check];
    console.log(`[migration:gate:release] running ${check}: ${definition.title}`);
    // eslint-disable-next-line no-await-in-loop
    const result = await runCheck(check, definition);
    results.push(result);
    console.log(
      `[migration:gate:release] ${check} ${result.passed ? 'PASS' : 'FAIL'} ` +
        `durationMs=${result.durationMs} code=${result.code ?? 'null'} signal=${result.signal ?? 'none'}`,
    );
  }

  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;
  const passRate = total === 0 ? 0 : passed / total;

  console.log(
    `[migration:gate:release] summary total=${total} passed=${passed} failed=${failed} passRate=${passRate.toFixed(3)}`,
  );

  const passRateOk = passRate >= minPassRate;
  const failuresOk = failed <= maxFailedChecks;

  let checkoutCoverageOk = true;
  const checkoutCoverageErrors = [];
  if (requireStripeCheckoutCoverage) {
    const targetChecks = results.filter((result) => result.key === 'runtime' || result.key === 'auth');
    let nonSkipCount = 0;

    for (const result of targetChecks) {
      if (!result.summary || !result.summary.checkout) {
        checkoutCoverageOk = false;
        checkoutCoverageErrors.push(`${result.key}:missing-summary`);
        continue;
      }

      const checkout = result.summary.checkout;
      const skipped = checkout.skipped === true || toBoolLikeStatus(checkout.status);
      if (skipped) {
        checkoutCoverageOk = false;
        checkoutCoverageErrors.push(
          `${result.key}:skipped(${checkout.reason || 'unknown_reason'})`,
        );
        continue;
      }

      nonSkipCount += 1;
    }

    if (nonSkipCount < minCheckoutNonSkip) {
      checkoutCoverageOk = false;
      checkoutCoverageErrors.push(
        `nonSkipCount(${nonSkipCount})<minCheckoutNonSkip(${minCheckoutNonSkip})`,
      );
    }
  }

  if (!passRateOk || !failuresOk || !checkoutCoverageOk) {
    const failedChecks = results.filter((result) => !result.passed).map((result) => result.key);
    throw new Error(
      '[migration:gate:release] FAILED ' +
        `(passRateOk=${passRateOk} failuresOk=${failuresOk} checkoutCoverageOk=${checkoutCoverageOk}) ` +
        `failedChecks=[${failedChecks.join(',')}] ` +
        `checkoutCoverageErrors=[${checkoutCoverageErrors.join(',')}]`,
    );
  }

  console.log('[migration:gate:release] PASSED');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
