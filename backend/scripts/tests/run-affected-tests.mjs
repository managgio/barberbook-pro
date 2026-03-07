import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');

const allContexts = ['booking', 'commerce', 'engagement', 'identity', 'platform', 'ai-orchestration'];
const allTypes = ['unit', 'contract', 'parity'];

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

const parseArgs = () =>
  new Set(
    process.argv.slice(2).filter((arg) => arg.startsWith('--')),
  );

const hasArg = (args, name) => args.has(name);

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

const unique = (items) => Array.from(new Set(items));

const hasExplicitRangeContext = () =>
  Boolean(
    process.env.TEST_CHANGED_DIFF_RANGE ||
      process.env.TEST_CHANGED_BASE_SHA ||
      process.env.GITHUB_BASE_SHA ||
      process.env.TEST_CHANGED_BASE_REF ||
      process.env.GITHUB_BASE_REF ||
      String(process.env.CI || '').toLowerCase() === 'true',
  );

const tryDiffRanges = () => {
  const ranges = [];
  const explicitRange = process.env.TEST_CHANGED_DIFF_RANGE;
  const baseSha = process.env.TEST_CHANGED_BASE_SHA || process.env.GITHUB_BASE_SHA;
  const headSha = process.env.TEST_CHANGED_HEAD_SHA || process.env.GITHUB_SHA;
  const baseRef = process.env.TEST_CHANGED_BASE_REF || process.env.GITHUB_BASE_REF;

  if (explicitRange) ranges.push(explicitRange);
  if (baseSha && headSha) ranges.push(`${baseSha}..${headSha}`);
  if (baseRef) ranges.push(`${baseRef}...HEAD`);
  if (String(process.env.CI || '').toLowerCase() === 'true') {
    ranges.push('HEAD~1..HEAD');
  }

  for (const range of ranges) {
    try {
      const output = runGit(['diff', '--name-only', '--diff-filter=ACMR', range, '--']);
      if (output) {
        return splitLines(output);
      }
    } catch {
      // keep trying fallbacks
    }
  }

  return [];
};

const getLocalWorkspaceChanges = () => {
  const changedTracked = splitLines(
    runGit(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--']),
  );
  const untracked = splitLines(runGit(['ls-files', '--others', '--exclude-standard']));
  return unique([...changedTracked, ...untracked]);
};

const collectChangedBackendFiles = () => {
  const fromRange = hasExplicitRangeContext() ? tryDiffRanges() : [];
  const localChanges = getLocalWorkspaceChanges();
  const files = unique([...localChanges, ...fromRange]);

  return files
    .filter((file) => file.startsWith('backend/'))
    .map((file) => file.slice('backend/'.length));
};

const isSourceLikeFile = (relativePath) =>
  relativePath.startsWith('src/') || relativePath.startsWith('prisma/') || relativePath.startsWith('scripts/');

const deriveContextFromPath = (relativePath) => {
  if (relativePath.startsWith('src/contexts/')) {
    const parts = relativePath.split('/');
    return parts[2] || null;
  }

  if (relativePath.startsWith('src/modules/')) {
    const parts = relativePath.split('/');
    const moduleName = parts[2] || '';
    return moduleToContext[moduleName] || null;
  }

  if (
    relativePath.startsWith('src/shared/') ||
    relativePath.startsWith('src/bootstrap/') ||
    relativePath.startsWith('src/prisma/') ||
    relativePath.startsWith('src/tenancy/') ||
    relativePath === 'src/app.module.ts' ||
    relativePath === 'src/main.ts' ||
    relativePath.startsWith('prisma/') ||
    relativePath.startsWith('scripts/migration/')
  ) {
    return '*';
  }

  return null;
};

const listTestFilesFor = ({ types, contexts }) => {
  const files = [];
  for (const type of types) {
    for (const context of contexts) {
      const contextDir = path.join(backendRoot, 'test', type, context);
      if (!fs.existsSync(contextDir)) continue;
      for (const entry of fs.readdirSync(contextDir)) {
        if (!entry.endsWith('.test.ts')) continue;
        files.push(path.join('test', type, context, entry));
      }
    }
  }
  return unique(files).sort();
};

const main = async () => {
  const args = parseArgs();
  const listOnly = hasArg(args, '--list');
  const changedFiles = collectChangedBackendFiles();

  const changedTests = changedFiles.filter(
    (file) => file.startsWith('test/') && file.endsWith('.test.ts'),
  );
  const changedSourceLike = changedFiles.filter(isSourceLikeFile);

  if (changedSourceLike.length === 0 && changedTests.length === 0) {
    console.log('Affected tests: no backend code/test changes detected. Skipping.');
    return;
  }

  const touchedContexts = new Set();
  let globalImpact = false;

  for (const file of changedSourceLike) {
    const context = deriveContextFromPath(file);
    if (!context) continue;
    if (context === '*') {
      globalImpact = true;
      continue;
    }
    touchedContexts.add(context);
  }

  const targetContexts = globalImpact || touchedContexts.size === 0 ? allContexts : Array.from(touchedContexts);

  const selected = new Set([
    ...changedTests,
    ...listTestFilesFor({ types: allTypes, contexts: targetContexts }),
  ]);

  const selectedFiles = Array.from(selected).sort();

  if (selectedFiles.length === 0) {
    console.log('Affected tests: no matching files found. Falling back to full suite.');
    if (listOnly) return;
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--test', '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'test/**/*.test.ts'],
        { cwd: backendRoot, stdio: 'inherit' },
      );
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`node:test exited with ${code}`))));
      child.on('error', reject);
    });
    return;
  }

  console.log(`Affected tests: selected ${selectedFiles.length} file(s).`);
  for (const file of selectedFiles) {
    console.log(` - ${file}`);
  }

  if (listOnly) return;

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--test', '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', ...selectedFiles],
      { cwd: backendRoot, stdio: 'inherit' },
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`node:test exited with ${code}`))));
    child.on('error', reject);
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
