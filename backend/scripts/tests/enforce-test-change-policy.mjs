import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');

const moduleToContext = {
  appointments: 'booking',
  barbers: 'booking',
  holidays: 'booking',
  schedules: 'booking',
  'barber-service-assignment': 'booking',
  offers: 'commerce',
  services: 'commerce',
  products: 'commerce',
  'product-categories': 'commerce',
  'service-categories': 'commerce',
  subscriptions: 'commerce',
  loyalty: 'commerce',
  payments: 'commerce',
  'cash-register': 'commerce',
  referrals: 'engagement',
  reviews: 'engagement',
  notifications: 'engagement',
  alerts: 'engagement',
  'client-notes': 'engagement',
  users: 'identity',
  roles: 'identity',
  firebase: 'identity',
  tenancy: 'platform',
  legal: 'platform',
  'audit-logs': 'platform',
  settings: 'platform',
  'platform-admin': 'platform',
  observability: 'platform',
  imagekit: 'platform',
  'ai-assistant': 'ai-orchestration',
};

const runGit = (args) =>
  execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const splitLines = (value) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const resolveRange = () => {
  if (process.env.TEST_CHANGED_DIFF_RANGE) return process.env.TEST_CHANGED_DIFF_RANGE;

  const baseSha = process.env.TEST_CHANGED_BASE_SHA || process.env.GITHUB_BASE_SHA;
  const headSha = process.env.TEST_CHANGED_HEAD_SHA || process.env.GITHUB_SHA;
  if (baseSha && headSha) return `${baseSha}..${headSha}`;

  const baseRef = process.env.TEST_CHANGED_BASE_REF || process.env.GITHUB_BASE_REF;
  if (baseRef) return `${baseRef}...HEAD`;

  if (String(process.env.CI || '').toLowerCase() === 'true') return 'HEAD~1..HEAD';
  return null;
};

const collectChangedEntries = () => {
  const range = resolveRange();
  const entries = [];

  if (range) {
    try {
      const output = runGit(['diff', '--name-status', '--diff-filter=ACMR', range, '--']);
      for (const line of splitLines(output)) {
        const [status, filePath] = line.split(/\s+/, 2);
        if (!filePath?.startsWith('backend/')) continue;
        entries.push({ status, path: filePath.slice('backend/'.length) });
      }
    } catch {
      // fallback below
    }
  }

  if (entries.length > 0 && String(process.env.CI || '').toLowerCase() === 'true') return entries;

  const fallbackChanged = splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--']));
  const fallbackEntries = fallbackChanged
    .filter((filePath) => filePath.startsWith('backend/'))
    .map((filePath) => ({ status: 'M', path: filePath.slice('backend/'.length) }));

  const untracked = splitLines(runGit(['ls-files', '--others', '--exclude-standard']))
    .filter((filePath) => filePath.startsWith('backend/'))
    .map((filePath) => ({ status: 'A', path: filePath.slice('backend/'.length) }));

  const dedup = new Map();
  for (const entry of [...fallbackEntries, ...untracked, ...entries]) {
    dedup.set(`${entry.status}:${entry.path}`, entry);
  }
  return Array.from(dedup.values());
};

const isCodeFile = (relativePath) =>
  relativePath.startsWith('src/') && relativePath.endsWith('.ts');

const isTestFile = (relativePath) =>
  relativePath.startsWith('test/') && relativePath.endsWith('.test.ts');

const deriveContextFromSource = (relativePath) => {
  if (relativePath.startsWith('src/contexts/')) {
    const parts = relativePath.split('/');
    return parts[2] || null;
  }
  if (relativePath.startsWith('src/modules/')) {
    const parts = relativePath.split('/');
    return moduleToContext[parts[2]] || null;
  }
  if (
    relativePath.startsWith('src/shared/') ||
    relativePath.startsWith('src/bootstrap/') ||
    relativePath.startsWith('src/prisma/') ||
    relativePath.startsWith('src/tenancy/') ||
    relativePath === 'src/app.module.ts' ||
    relativePath === 'src/main.ts'
  ) {
    return '*';
  }
  return null;
};

const deriveContextFromTest = (relativePath) => {
  const parts = relativePath.split('/');
  if (parts.length < 4) return null;
  return parts[2] || null;
};

const isAddedFeatureFile = (entry) => {
  if (!entry.status.startsWith('A')) return false;
  const file = entry.path;
  if (!isCodeFile(file)) return false;
  if (file.endsWith('.module.ts') || file.endsWith('.dto.ts') || file.endsWith('.types.ts') || file.endsWith('.port.ts')) {
    return false;
  }
  return file.startsWith('src/contexts/') || file.startsWith('src/modules/');
};

const main = () => {
  const allowNoTests = String(process.env.TEST_POLICY_ALLOW_NO_TESTS || '').toLowerCase() === 'true';
  const entries = collectChangedEntries();
  const changedCode = entries.filter((entry) => isCodeFile(entry.path));
  const changedTests = entries.filter((entry) => isTestFile(entry.path));

  if (changedCode.length === 0) {
    console.log('Test policy: no backend source changes detected.');
    return;
  }

  if (!allowNoTests && changedTests.length === 0) {
    throw new Error(
      'Test policy violation: backend source changed but no test file changed. Add/update tests in backend/test.',
    );
  }

  const sourceContexts = new Set(
    changedCode
      .map((entry) => deriveContextFromSource(entry.path))
      .filter(Boolean),
  );
  const testContexts = new Set(
    changedTests
      .map((entry) => deriveContextFromTest(entry.path))
      .filter(Boolean),
  );

  if (!allowNoTests && !sourceContexts.has('*')) {
    const missingContexts = Array.from(sourceContexts).filter((context) => !testContexts.has(context));
    if (missingContexts.length > 0) {
      throw new Error(
        `Test policy violation: missing changed tests for context(s): ${missingContexts.join(', ')}.`,
      );
    }
  }

  const addedFeatureFiles = entries.filter(isAddedFeatureFile);
  const addedTests = changedTests.filter((entry) => entry.status.startsWith('A'));
  if (!allowNoTests && addedFeatureFiles.length > 0 && addedTests.length === 0) {
    throw new Error(
      'Test policy violation: new feature/source files detected without new test files. Add at least one new *.test.ts.',
    );
  }

  console.log(
    `Test policy passed. changedCode=${changedCode.length}, changedTests=${changedTests.length}, contexts=${Array.from(sourceContexts).join(',') || '-'}.`,
  );
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
