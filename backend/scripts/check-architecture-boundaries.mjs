import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');

const IMPORT_RE = /^import\s+[^;]+\s+from\s+['"]([^'"]+)['"];?$/gm;

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (extname(full) === '.ts') out.push(full);
  }
  return out;
};

const tryResolveImport = (fromFile, specifier) => {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('src/')) {
    return null;
  }

  let base;
  if (specifier.startsWith('@/')) {
    base = join(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith('src/')) {
    base = join(ROOT, specifier);
  } else {
    base = resolve(dirname(fromFile), specifier);
  }

  const candidates = [base, `${base}.ts`, join(base, 'index.ts')];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return normalize(candidate);
    } catch {
      // ignore
    }
  }

  return null;
};

const getContextName = (filePath) => {
  const rel = relative(SRC_ROOT, filePath).replace(/\\/g, '/');
  const match = rel.match(/^contexts\/([^/]+)\//);
  return match ? match[1] : null;
};

const isDomain = (rel) => /src\/contexts\/[^/]+\/domain\/.+\.ts$/.test(rel.replace(/\\/g, '/'));
const isApplication = (rel) => /src\/contexts\/[^/]+\/application\/.+\.ts$/.test(rel.replace(/\\/g, '/'));
const isContextFile = (rel) => /src\/contexts\/[^/]+\/.+\.ts$/.test(rel.replace(/\\/g, '/'));
const isCommercePrismaInfrastructure = (rel) =>
  /src\/contexts\/commerce\/infrastructure\/prisma\/.+\.ts$/.test(rel.replace(/\\/g, '/'));
const isBookingPrismaInfrastructure = (rel) =>
  /src\/contexts\/booking\/infrastructure\/prisma\/.+\.ts$/.test(rel.replace(/\\/g, '/'));

const isBlockedByLayer = (kind, importPath) => {
  const blockedCommon = [
    '@nestjs/',
    '@prisma/client',
    '/prisma/',
    '/modules/',
    '/tenancy/',
    'stripe',
    'twilio',
    'openai',
    'firebase-admin',
    'nodemailer',
    'imagekit',
  ];

  if (blockedCommon.some((token) => importPath.includes(token))) return true;

  if (kind === 'application') {
    if (importPath.includes('/infrastructure/')) return true;
  }

  return false;
};

const isAllowedCrossContext = (resolvedImport) => {
  const rel = relative(SRC_ROOT, resolvedImport).replace(/\\/g, '/');
  return (
    rel.includes('/ports/') ||
    rel.includes('/application/inbound/') ||
    rel.startsWith('shared/')
  );
};

const files = walk(SRC_ROOT);
const violations = [];

for (const file of files) {
  const relFile = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  let match = IMPORT_RE.exec(source);
  while (match) {
    const specifier = match[1];

    if (isDomain(relFile) && isBlockedByLayer('domain', specifier)) {
      violations.push(`${relFile}: domain import prohibido -> ${specifier}`);
    }

    if (isApplication(relFile) && isBlockedByLayer('application', specifier)) {
      violations.push(`${relFile}: application import prohibido -> ${specifier}`);
    }

    if (isContextFile(relFile) && specifier.includes('/modules/')) {
      violations.push(`${relFile}: contexts/* no puede importar modules/* -> ${specifier}`);
    }

    if (
      isCommercePrismaInfrastructure(relFile) &&
      (specifier.includes('/modules/services/') ||
        specifier.includes('/modules/products/') ||
        specifier.includes('/modules/settings/'))
    ) {
      violations.push(
        `${relFile}: commerce prisma infrastructure no puede importar helpers desde modules/* -> ${specifier}`,
      );
    }

    if (
      isBookingPrismaInfrastructure(relFile) &&
      (specifier.includes('/modules/schedules/') || specifier.includes('/modules/settings/'))
    ) {
      violations.push(
        `${relFile}: booking prisma infrastructure no puede importar helpers desde modules/schedules|settings -> ${specifier}`,
      );
    }

    const importerContext = getContextName(file);
    const resolved = tryResolveImport(file, specifier);
    const importedContext = resolved ? getContextName(resolved) : null;

    if (importerContext && importedContext && importerContext !== importedContext) {
      if (!isAllowedCrossContext(resolved)) {
        violations.push(
          `${relFile}: cross-context import no permitido (${importerContext} -> ${importedContext}) -> ${specifier}`,
        );
      }
    }

    match = IMPORT_RE.exec(source);
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary violations found:');
  violations.forEach((v) => console.error(`- ${v}`));
  process.exit(1);
}

console.log('Architecture boundaries check passed');
