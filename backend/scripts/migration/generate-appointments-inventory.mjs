import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CONTROLLER_PATH = join(ROOT, 'src/modules/appointments/appointments.controller.ts');
const SERVICE_PATH = join(ROOT, 'src/modules/appointments/appointments.service.ts');
const SRC_ROOT = join(ROOT, 'src');
const OUTPUT_PATH = join(ROOT, 'docs/migration/inventory-appointments.md');

const read = (path) => readFileSync(path, 'utf8');

const normalizeRoutePath = (base, raw) => {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed === "''" || trimmed === '""') return base;
  const cleaned = trimmed.replace(/^['"]|['"]$/g, '');
  if (!cleaned) return base;
  return `${base}/${cleaned}`.replace(/\/+/g, '/');
};

const extractEndpoints = (content) => {
  const lines = content.split('\n');
  const endpoints = [];
  let pendingAdmin = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('@AdminEndpoint(') || line === '@AdminEndpoint()') {
      pendingAdmin = true;
      continue;
    }

    const httpMatch = line.match(/^@(Get|Post|Patch|Delete)\(([^)]*)\)/);
    if (!httpMatch) continue;

    const [, method, rawPath] = httpMatch;
    let handler = 'unknown';
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.startsWith('@')) continue;
      const handlerMatch = candidate.match(/^(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/);
      if (handlerMatch) {
        handler = handlerMatch[1];
      }
      break;
    }

    endpoints.push({
      method: method.toUpperCase(),
      path: normalizeRoutePath('/appointments', rawPath),
      handler,
      adminOnly: pendingAdmin,
    });

    pendingAdmin = false;
  }

  return endpoints;
};

const extractImports = (content) => {
  const imports = [];
  const regex = /^import\s+[^;]+\s+from\s+['"]([^'"]+)['"];?$/gm;
  let match = regex.exec(content);
  while (match) {
    imports.push(match[1]);
    match = regex.exec(content);
  }
  return imports;
};

const extractConstructorDeps = (content) => {
  const constructorBlockMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{\s*\}/m);
  if (!constructorBlockMatch) return [];

  const block = constructorBlockMatch[1];
  const depRegex = /private\s+readonly\s+([a-zA-Z0-9_]+):\s*([a-zA-Z0-9_<>]+)/g;
  const deps = [];
  let match = depRegex.exec(block);
  while (match) {
    deps.push({ field: match[1], type: match[2] });
    match = depRegex.exec(block);
  }
  return deps;
};

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (fullPath.endsWith('.ts')) files.push(fullPath);
  }
  return files;
};

const extractReverseImports = () => {
  const files = walk(SRC_ROOT);
  const hits = [];
  for (const file of files) {
    const source = read(file);
    if (
      source.includes("from './appointments.service'") ||
      source.includes("from '../appointments/appointments.service'") ||
      source.includes('from \"./appointments.service\"') ||
      source.includes('from \"../appointments/appointments.service\"')
    ) {
      hits.push(relative(ROOT, file));
    }
  }
  return hits.sort();
};

const now = new Date().toISOString();
const controller = read(CONTROLLER_PATH);
const service = read(SERVICE_PATH);
const endpoints = extractEndpoints(controller);
const imports = extractImports(service);
const constructorDeps = extractConstructorDeps(service);
const reverseImports = extractReverseImports();

const lines = [];
lines.push('# Inventario Automático de Appointments');
lines.push('');
lines.push(`- Generado: ${now}`);
lines.push(`- Fuente controller: \`${relative(ROOT, CONTROLLER_PATH)}\``);
lines.push(`- Fuente service: \`${relative(ROOT, SERVICE_PATH)}\``);
lines.push('');
lines.push('## Endpoints (`AppointmentsController`)');
lines.push('');
lines.push('| Método | Path | Handler | Admin |');
lines.push('|---|---|---|---|');
for (const endpoint of endpoints) {
  lines.push(`| ${endpoint.method} | ${endpoint.path} | ${endpoint.handler} | ${endpoint.adminOnly ? 'yes' : 'no'} |`);
}
lines.push('');
lines.push('## Import Graph (`appointments.service.ts` -> dependencias directas)');
lines.push('');
for (const item of imports) {
  lines.push(`- \`${item}\``);
}
lines.push('');
lines.push('## Constructor DI Graph (`appointments.service.ts`)');
lines.push('');
for (const dep of constructorDeps) {
  lines.push(`- \`${dep.field}: ${dep.type}\``);
}
lines.push('');
lines.push('## Reverse Graph (módulos que importan `AppointmentsService`)');
lines.push('');
for (const file of reverseImports) {
  lines.push(`- \`${file}\``);
}
lines.push('');
lines.push('## Regeneración');
lines.push('');
lines.push('- Ejecutar: `node scripts/migration/generate-appointments-inventory.mjs`');

writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${relative(ROOT, OUTPUT_PATH)}`);
