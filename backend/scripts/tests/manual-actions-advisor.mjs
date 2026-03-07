import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');

const parsePhaseArg = () => {
  const phaseArg = process.argv.find((arg) => arg.startsWith('--phase='));
  const phase = (phaseArg?.split('=')[1] || 'dev').toLowerCase();
  return phase === 'push' || phase === 'pr' ? phase : 'dev';
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

  if (entries.length > 0 && String(process.env.CI || '').toLowerCase() === 'true') {
    return entries;
  }

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

const isTestFile = (relativePath) =>
  relativePath.startsWith('test/') && relativePath.endsWith('.test.ts');

const isSourceTsFile = (relativePath) =>
  relativePath.startsWith('src/') && relativePath.endsWith('.ts');

const isGlobalCriticalPath = (relativePath) =>
  relativePath.startsWith('src/shared/') ||
  relativePath.startsWith('src/bootstrap/') ||
  relativePath.startsWith('src/prisma/') ||
  relativePath.startsWith('src/tenancy/') ||
  relativePath === 'src/app.module.ts' ||
  relativePath === 'src/main.ts' ||
  relativePath.startsWith('prisma/');

const isDomainOrApplicationPath = (relativePath) =>
  /^src\/contexts\/[^/]+\/(domain|application)\//.test(relativePath);

const isAdapterOrContractPath = (relativePath) =>
  /^src\/contexts\/[^/]+\/(infrastructure|interfaces|ports)\//.test(relativePath) ||
  relativePath.startsWith('src/modules/') ||
  relativePath.endsWith('.port.ts');

const isParitySensitivePath = (relativePath) =>
  relativePath.includes('/legacy') ||
  relativePath.includes('.legacy.') ||
  relativePath.includes('/facade') ||
  relativePath.includes('/shadow') ||
  relativePath.includes('appointments');

const isAddedFeatureSource = (entry) => {
  if (!entry.status.startsWith('A')) return false;
  const file = entry.path;
  if (!isSourceTsFile(file)) return false;
  if (
    file.endsWith('.module.ts') ||
    file.endsWith('.dto.ts') ||
    file.endsWith('.types.ts') ||
    file.endsWith('.port.ts')
  ) {
    return false;
  }
  return file.startsWith('src/contexts/') || file.startsWith('src/modules/');
};

const pushUnique = (list, item) => {
  if (!list.includes(item)) list.push(item);
};

const main = () => {
  const phase = parsePhaseArg();
  const entries = collectChangedEntries();
  const changedFiles = entries.map((entry) => entry.path);

  const changedTests = entries.filter((entry) => isTestFile(entry.path));
  const changedSource = entries.filter((entry) => isSourceTsFile(entry.path));

  const hasBackendChanges = changedFiles.length > 0;
  const hasSourceChanges = changedSource.length > 0;
  const hasDomainApplicationChanges = changedFiles.some(isDomainOrApplicationPath);
  const hasAdapterContractChanges = changedFiles.some(isAdapterOrContractPath);
  const hasParitySensitiveChanges = changedFiles.some(isParitySensitivePath);
  const hasGlobalCriticalChanges = changedFiles.some(isGlobalCriticalPath);
  const hasNewFeatureSource = entries.some(isAddedFeatureSource);

  const required = [];
  const conditional = [];
  const reminders = [];

  if (!hasBackendChanges) {
    console.log('[test:advisor] No hay cambios en backend detectados. No hay acciones manuales recomendadas.');
    return;
  }

  pushUnique(required, 'npm run test:changed');

  if (hasDomainApplicationChanges) {
    pushUnique(required, 'npm run test:unit');
  }
  if (hasAdapterContractChanges) {
    pushUnique(required, 'npm run test:contract');
  }
  if (hasParitySensitiveChanges) {
    pushUnique(conditional, 'npm run test:parity (si tocaste comportamiento legacy/v2)');
  }

  if ((phase === 'push' || phase === 'pr') && hasSourceChanges) {
    pushUnique(required, 'npm run test:policy');
    pushUnique(required, 'npm run test:coverage:gate');
  }

  if ((phase === 'push' || phase === 'pr') && hasGlobalCriticalChanges) {
    pushUnique(required, 'npm run test:ci');
  } else if (phase === 'pr') {
    pushUnique(conditional, 'npm run test:ci (si el cambio es amplio/critico)');
  }

  if (hasSourceChanges && changedTests.length === 0) {
    reminders.push('Cambiaste src/ pero no test/. test:policy va a fallar hasta añadir o actualizar tests.');
  }
  if (hasNewFeatureSource) {
    reminders.push('Detectados archivos funcionales nuevos: añade al menos un test nuevo de feature.');
  }

  console.log(`[test:advisor] Fase: ${phase}`);
  console.log(`[test:advisor] Cambios detectados: files=${changedFiles.length}, src=${changedSource.length}, tests=${changedTests.length}`);

  if (required.length > 0) {
    console.log('[test:advisor] Comandos recomendados (ejecutar ahora):');
    for (const command of required) {
      console.log(` - ${command}`);
    }
  }

  if (conditional.length > 0) {
    console.log('[test:advisor] Comandos condicionales (solo si aplica):');
    for (const command of conditional) {
      console.log(` - ${command}`);
    }
  }

  if (reminders.length > 0) {
    console.log('[test:advisor] Recordatorios:');
    for (const reminder of reminders) {
      console.log(` - ${reminder}`);
    }
  }
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
