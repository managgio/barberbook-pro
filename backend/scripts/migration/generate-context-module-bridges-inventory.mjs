import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CONTEXTS_ROOT = join(ROOT, 'src/contexts');
const OUTPUT_PATH = join(ROOT, 'docs/migration/context-module-bridges-inventory.md');
const CHECK_MODE = process.argv.includes('--check');
const REQUIRE_ZERO_PRESENT = process.argv.includes('--require-zero-present');

const IMPORT_RE = /^import\s+[^;]+\s+from\s+['"]([^'"]+)['"];?$/gm;

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (full.endsWith('.ts')) files.push(full);
  }
  return files;
};

const getContext = (relPath) => {
  const match = relPath.replace(/\\/g, '/').match(/^src\/contexts\/([^/]+)\//);
  return match ? match[1] : 'unknown';
};

const getLayer = (relPath) => {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.includes('/domain/')) return 'domain';
  if (normalized.includes('/application/')) return 'application';
  if (normalized.includes('/ports/')) return 'ports';
  if (normalized.includes('/infrastructure/')) return 'infrastructure';
  if (normalized.includes('/interfaces/')) return 'interfaces';
  return 'other';
};

const extractModuleName = (specifier) => {
  const normalized = specifier.replace(/\\/g, '/');
  const match = normalized.match(/\/modules\/([^/]+)\//);
  return match ? match[1] : 'unknown';
};

const files = walk(CONTEXTS_ROOT);
const hits = [];

for (const file of files) {
  const relFile = relative(ROOT, file);
  const content = readFileSync(file, 'utf8');
  let match = IMPORT_RE.exec(content);
  while (match) {
    const specifier = match[1];
    if (specifier.includes('/modules/')) {
      hits.push({
        context: getContext(relFile),
        layer: getLayer(relFile),
        importer: relFile,
        module: extractModuleName(specifier),
        specifier,
      });
    }
    match = IMPORT_RE.exec(content);
  }
}

hits.sort((a, b) => {
  if (a.context !== b.context) return a.context.localeCompare(b.context);
  if (a.layer !== b.layer) return a.layer.localeCompare(b.layer);
  if (a.importer !== b.importer) return a.importer.localeCompare(b.importer);
  return a.specifier.localeCompare(b.specifier);
});

const byContext = new Map();
for (const hit of hits) {
  byContext.set(hit.context, (byContext.get(hit.context) || 0) + 1);
}

const byModule = new Map();
for (const hit of hits) {
  byModule.set(hit.module, (byModule.get(hit.module) || 0) + 1);
}

const buildInventoryContent = () => {
  const lines = [];
  lines.push('# Inventario de Bridges Contexts -> Modules');
  lines.push('');
  lines.push(`- Generado: ${new Date().toISOString()}`);
  lines.push(`- Total imports detectados: ${hits.length}`);
  lines.push(`- Contextos afectados: ${byContext.size}`);
  lines.push(`- Módulos legacy referenciados: ${byModule.size}`);
  lines.push('');
  lines.push('## Resumen por Contexto');
  lines.push('');
  lines.push('| Contexto | Imports hacia modules/* |');
  lines.push('|---|---:|');
  for (const [context, count] of [...byContext.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| ${context} | ${count} |`);
  }
  lines.push('');
  lines.push('## Resumen por Módulo Legacy');
  lines.push('');
  lines.push('| Modulo | Referencias desde contexts/* |');
  lines.push('|---|---:|');
  for (const [moduleName, count] of [...byModule.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`| ${moduleName} | ${count} |`);
  }
  lines.push('');
  lines.push('## Detalle');
  lines.push('');
  lines.push('| Contexto | Capa | Importador | Modulo | Specifier |');
  lines.push('|---|---|---|---|---|');
  for (const hit of hits) {
    lines.push(`| ${hit.context} | ${hit.layer} | \`${hit.importer}\` | ${hit.module} | \`${hit.specifier}\` |`);
  }
  lines.push('');
  lines.push('## Regeneración');
  lines.push('');
  lines.push('- Ejecutar: `npm run migration:inventory:context-module-bridges`');
  return `${lines.join('\n')}\n`;
};

const normalizeForCheck = (content) => content.replace(/^- Generado: .*\n/m, '- Generado: <normalized>\n');
const nextContent = buildInventoryContent();

if (!CHECK_MODE) {
  writeFileSync(OUTPUT_PATH, nextContent, 'utf8');
  console.log(`Wrote ${relative(ROOT, OUTPUT_PATH)}`);
  process.exit(0);
}

if (!existsSync(OUTPUT_PATH)) {
  console.error(`Missing ${relative(ROOT, OUTPUT_PATH)}. Run npm run migration:inventory:context-module-bridges`);
  process.exit(1);
}

const currentContent = readFileSync(OUTPUT_PATH, 'utf8');
const isSynced = normalizeForCheck(currentContent) === normalizeForCheck(nextContent);
if (!isSynced) {
  console.error('Context-module bridges inventory is out of date.');
  console.error('Run npm run migration:inventory:context-module-bridges and commit the result.');
  process.exit(1);
}

if (REQUIRE_ZERO_PRESENT && hits.length > 0) {
  console.error(`Context-module bridges inventory has active bridges: ${hits.length}`);
  console.error('Remove remaining contexts/* -> modules/* imports before merging.');
  process.exit(1);
}

console.log('Context-module bridges inventory is up to date.');
