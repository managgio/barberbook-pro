import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MODULES_ROOT = join(ROOT, 'src/modules');
const OUTPUT_PATH = join(ROOT, 'docs/migration/residual-debt-prioritization.md');

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (full.endsWith('.service.ts')) files.push(full);
  }
  return files;
};

const toPriority = (score) => {
  if (score >= 12) return 'P0';
  if (score >= 9) return 'P1';
  if (score >= 6) return 'P2';
  return 'P3';
};

const contextByModule = {
  appointments: 'booking',
  barbers: 'booking',
  holidays: 'booking',
  schedules: 'booking',
  services: 'commerce',
  products: 'commerce',
  offers: 'commerce',
  subscriptions: 'commerce',
  loyalty: 'commerce',
  'cash-register': 'commerce',
  referrals: 'engagement+commerce',
  notifications: 'engagement',
  reviews: 'engagement',
  'client-notes': 'engagement',
  users: 'identity',
  roles: 'identity',
  'ai-assistant': 'ai-orchestration',
  'platform-admin': 'platform',
  observability: 'platform',
  'usage-metrics': 'platform',
  settings: 'platform',
  legal: 'platform',
  tenancy: 'platform',
};

const recommendationByModule = {
  appointments:
    'Split remaining legacy orchestration from modules/appointments into booking application handlers.',
  'cash-register':
    'Extract movement/stock invariants into commerce application + domain service and keep module as HTTP adapter.',
  referrals:
    'Finish separating referral config/templates/analytics into engagement/commerce ports and remove Prisma-heavy orchestration from module.',
  payments:
    'Move remaining payment state transitions and cancellation policies to commerce application services.',
  subscriptions:
    'Reduce Prisma-heavy branching by extracting subscription lifecycle use cases into commerce application.',
  loyalty:
    'Consolidate loyalty write rules into commerce application and leave module as adapter shell.',
  'platform-admin':
    'Extract platform admin health/config policies into platform context application services.',
  'usage-metrics':
    'Move provider metrics aggregation logic into platform application services with thinner module wrapper.',
  reviews:
    'Extract review request/analytics workflows to engagement application and minimize direct Prisma in module.',
};

const serviceFiles = walk(MODULES_ROOT);
const moduleRows = new Map();

for (const file of serviceFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const match = rel.match(/^src\/modules\/([^/]+)\//);
  if (!match) continue;
  const moduleName = match[1];
  const content = readFileSync(file, 'utf8');
  const loc = content.split('\n').length;

  const hasPrisma = /prisma\/prisma\.service/.test(content);
  const hasTenantContext = /TENANT_CONTEXT_PORT/.test(content);
  const portInjectCount = (content.match(/@Inject\([A-Z0-9_]+_PORT\)/g) || []).length;
  const useCaseImportCount = (content.match(/\/application\/use-cases\//g) || []).length;
  const sdkCount =
    Number(/from 'stripe'/.test(content)) +
    Number(/from 'twilio'/.test(content)) +
    Number(/from 'openai'/.test(content)) +
    Number(/from 'firebase-admin'/.test(content)) +
    Number(/from 'nodemailer'/.test(content)) +
    Number(/from 'imagekit'/.test(content));
  const crossModuleUtilsCount = (content.match(/from '\.\.\/[^']+\/[^']+\.utils'/g) || []).length;
  const directModuleServiceDeps = (content.match(/from '\.\.\/[^']+\/[^']+\.service'/g) || []).length;

  const current = moduleRows.get(moduleName) || {
    moduleName,
    services: 0,
    totalLoc: 0,
    hasPrisma: false,
    hasTenantContext: false,
    portInjectCount: 0,
    useCaseImportCount: 0,
    sdkCount: 0,
    crossModuleUtilsCount: 0,
    directModuleServiceDeps: 0,
    files: [],
  };

  current.services += 1;
  current.totalLoc += loc;
  current.hasPrisma = current.hasPrisma || hasPrisma;
  current.hasTenantContext = current.hasTenantContext || hasTenantContext;
  current.portInjectCount += portInjectCount;
  current.useCaseImportCount += useCaseImportCount;
  current.sdkCount += sdkCount;
  current.crossModuleUtilsCount += crossModuleUtilsCount;
  current.directModuleServiceDeps += directModuleServiceDeps;
  current.files.push(rel);
  moduleRows.set(moduleName, current);
}

const scoredRows = [...moduleRows.values()].map((row) => {
  let score = 0;

  if (row.hasPrisma) score += 6;
  if (row.totalLoc >= 1200) score += 6;
  else if (row.totalLoc >= 700) score += 5;
  else if (row.totalLoc >= 400) score += 4;
  else if (row.totalLoc >= 250) score += 3;
  else if (row.totalLoc >= 120) score += 2;
  else score += 1;

  score += Math.min(4, row.sdkCount * 2);
  if (row.crossModuleUtilsCount > 0) score += 2;
  if (row.directModuleServiceDeps > 0) score += 2;
  if (row.portInjectCount >= 3) score -= 1;
  if (!row.hasPrisma && row.useCaseImportCount > 0) score -= 2;

  return {
    ...row,
    score,
    priority: toPriority(score),
    pending:
      row.hasPrisma ||
      row.sdkCount > 0 ||
      row.crossModuleUtilsCount > 0 ||
      row.directModuleServiceDeps > 0,
    targetContext: contextByModule[row.moduleName] || 'tbd',
    recommendation:
      recommendationByModule[row.moduleName] ||
      'Continue migrating module-specific business rules into context application/use-cases and keep module as adapter.',
  };
});

scoredRows.sort((a, b) => {
  const priorityRank = { P0: 4, P1: 3, P2: 2, P3: 1 };
  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[b.priority] - priorityRank[a.priority];
  }
  if (a.score !== b.score) return b.score - a.score;
  return b.totalLoc - a.totalLoc;
});

const totals = {
  modules: scoredRows.length,
  services: scoredRows.reduce((acc, row) => acc + row.services, 0),
  withPrisma: scoredRows.filter((row) => row.hasPrisma).length,
  p0: scoredRows.filter((row) => row.priority === 'P0').length,
  p1: scoredRows.filter((row) => row.priority === 'P1').length,
  p2: scoredRows.filter((row) => row.priority === 'P2').length,
  p3: scoredRows.filter((row) => row.priority === 'P3').length,
  pending: scoredRows.filter((row) => row.pending).length,
  pendingP0: scoredRows.filter((row) => row.pending && row.priority === 'P0').length,
  pendingP1: scoredRows.filter((row) => row.pending && row.priority === 'P1').length,
  pendingP2: scoredRows.filter((row) => row.pending && row.priority === 'P2').length,
  pendingP3: scoredRows.filter((row) => row.pending && row.priority === 'P3').length,
};

const lines = [];
lines.push('# Residual Debt Prioritization (Post-Migration)');
lines.push('');
lines.push(`- Generated: ${new Date().toISOString()}`);
lines.push(`- Modules analyzed: ${totals.modules}`);
lines.push(`- Service files analyzed: ${totals.services}`);
lines.push(`- Modules with direct Prisma usage: ${totals.withPrisma}`);
lines.push(`- Priority distribution: P0=${totals.p0}, P1=${totals.p1}, P2=${totals.p2}, P3=${totals.p3}`);
lines.push(
  `- Pending backlog (real debt): total=${totals.pending}, P0=${totals.pendingP0}, P1=${totals.pendingP1}, P2=${totals.pendingP2}, P3=${totals.pendingP3}`,
);
lines.push('');
lines.push('## Scoring Heuristics');
lines.push('');
lines.push('- Higher score means higher refactor priority.');
lines.push('- Score factors: module size (LOC), direct Prisma dependency, external SDK usage, cross-module helpers, direct service-to-service module dependencies.');
lines.push('- Score reducers: module already using ports/use-cases and low direct infrastructure coupling.');
lines.push('');
lines.push('## Prioritized Modules (Pending Only)');
lines.push('');
lines.push('| Priority | Module | Score | Pending (real debt) | Services | LOC | Prisma | Port Injects | Target Context |');
lines.push('|---|---|---:|---|---:|---:|---|---:|---|');
const pendingRows = scoredRows.filter((row) => row.pending);
if (pendingRows.length === 0) {
  lines.push('| - | - | - | - | - | - | - | - | - |');
  lines.push('');
  lines.push('- No pending modules to prioritize.');
} else {
  for (const row of pendingRows) {
    lines.push(
      `| ${row.priority} | ${row.moduleName} | ${row.score} | yes | ${row.services} | ${row.totalLoc} | ${row.hasPrisma ? 'yes' : 'no'} | ${row.portInjectCount} | ${row.targetContext} |`,
    );
  }
}

lines.push('');
lines.push('## Pending Backlog (Unresolved Couplings)');
lines.push('');
lines.push('| Priority | Module | Score | Prisma | SDK Imports | Cross Utils | Service Deps |');
lines.push('|---|---|---:|---|---:|---:|---:|');
if (pendingRows.length === 0) {
  lines.push('| - | - | - | - | - | - | - |');
  lines.push('');
  lines.push('- No pending modules with unresolved couplings.');
} else {
  for (const row of pendingRows) {
    lines.push(
      `| ${row.priority} | ${row.moduleName} | ${row.score} | ${row.hasPrisma ? 'yes' : 'no'} | ${row.sdkCount} | ${row.crossModuleUtilsCount} | ${row.directModuleServiceDeps} |`,
    );
  }
}

lines.push('');
lines.push('## Top Actionable Backlog');
lines.push('');

const topRows = pendingRows
  .filter((row) => row.priority === 'P0' || row.priority === 'P1' || row.priority === 'P2' || row.priority === 'P3')
  .slice(0, 10);
if (topRows.length === 0) {
  lines.push('- No pending P0/P1/P2/P3 modules detected.');
} else {
  topRows.forEach((row, index) => {
    lines.push(`${index + 1}. \`${row.moduleName}\` (${row.priority}, score=${row.score}) -> ${row.recommendation}`);
  });
}

lines.push('');
lines.push('## Regeneration');
lines.push('');
lines.push('- Command: `npm run migration:inventory:residual-debt`');
lines.push('');

writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${relative(ROOT, OUTPUT_PATH)}`);
