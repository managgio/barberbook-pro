import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = path.resolve(process.cwd(), 'src/modules');

const IGNORED_PATH_FRAGMENTS = [
  `${path.sep}platform-admin${path.sep}`,
  `${path.sep}usage-metrics${path.sep}`,
];

const ACTIONS_TO_CHECK = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const LOCAL_SCOPED_MODELS = new Set([
  'adminRole',
  'locationStaff',
  'barber',
  'service',
  'appointment',
  'alert',
  'generalHoliday',
  'barberHoliday',
  'shopSchedule',
  'siteSettings',
  'barberSchedule',
  'serviceCategory',
  'offer',
  'loyaltyProgram',
  'productCategory',
  'product',
  'referralProgramConfig',
  'referralCode',
  'referralAttribution',
  'reviewProgramConfig',
  'reviewRequest',
  'rewardWallet',
  'rewardTransaction',
  'coupon',
  'clientNote',
  'cashMovement',
  'cashMovementProductItem',
  'aiChatSession',
  'aiChatMessage',
  'aiBusinessFact',
]);

const BRAND_SCOPED_MODELS = new Set([
  'brandConfig',
  'brandLegalSettings',
  'brandUser',
  'providerUsageDaily',
]);

const QUERY_CALL_REGEX = /(?:\b(?:this\.)?(?:prisma|tx))\.(\w+)\.(\w+)\(/g;
const INLINE_IGNORE_TOKEN = 'tenant-scope-ignore';
const MAX_SNIPPET_LENGTH = 1_400;

const toLineColumn = (source, index) => {
  const untilIndex = source.slice(0, index);
  const lines = untilIndex.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
};

const isIgnoredFile = (filePath) =>
  IGNORED_PATH_FRAGMENTS.some((fragment) => filePath.includes(fragment));

const resolveScopeRequirement = (model) => {
  if (LOCAL_SCOPED_MODELS.has(model)) return 'localId';
  if (BRAND_SCOPED_MODELS.has(model)) return 'brandId';
  return null;
};

const hasInlineIgnore = (source, callIndex) => {
  const windowStart = Math.max(0, callIndex - 220);
  const window = source.slice(windowStart, callIndex);
  return window.includes(INLINE_IGNORE_TOKEN);
};

const hasScopeInWhereVariable = (source, callIndex, snippet, scopeField) => {
  let variableName = null;
  if (/\bwhere\s*,/.test(snippet) || /\bwhere\s*}/.test(snippet)) {
    variableName = 'where';
  } else {
    const explicitWhere = snippet.match(/\bwhere\s*:\s*([a-zA-Z_$][\w$]*)/);
    variableName = explicitWhere?.[1] || null;
  }
  if (!variableName) return false;

  const backWindow = source.slice(Math.max(0, callIndex - 6_000), callIndex);
  const declarationRegex = new RegExp(
    `\\b(?:const|let|var)\\s+${variableName}(?:\\s*:[^=\\n]+)?\\s*=([\\s\\S]{0,1600})`,
    'gm',
  );
  const declarations = [...backWindow.matchAll(declarationRegex)];
  if (declarations.length === 0) return false;
  const nearestDeclaration = declarations[declarations.length - 1];
  return new RegExp(`\\b${scopeField}\\b`).test(nearestDeclaration[1] || '');
};

const collectTsFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectTsFiles(fullPath);
      if (entry.isFile() && fullPath.endsWith('.ts')) return [fullPath];
      return [];
    }),
  );
  return nested.flat();
};

const run = async () => {
  const files = await collectTsFiles(ROOT_DIR);
  const findings = [];

  for (const filePath of files) {
    if (isIgnoredFile(filePath)) continue;
    const source = await fs.readFile(filePath, 'utf8');
    QUERY_CALL_REGEX.lastIndex = 0;

    let match;
    while ((match = QUERY_CALL_REGEX.exec(source)) !== null) {
      const model = match[1];
      const action = match[2];
      if (!ACTIONS_TO_CHECK.has(action)) continue;

      const scopeField = resolveScopeRequirement(model);
      if (!scopeField) continue;
      if (hasInlineIgnore(source, match.index)) continue;

      const snippet = source.slice(match.index, match.index + MAX_SNIPPET_LENGTH);
      const hasRequiredScope =
        new RegExp(`\\b${scopeField}\\b`).test(snippet) ||
        hasScopeInWhereVariable(source, match.index, snippet, scopeField);

      if (hasRequiredScope) continue;

      const { line, column } = toLineColumn(source, match.index);
      findings.push({
        filePath,
        line,
        column,
        model,
        action,
        scopeField,
      });
    }
  }

  if (findings.length === 0) {
    console.log('Tenant scope check passed: no unscoped Prisma calls detected.');
    return;
  }

  console.error(`Tenant scope check failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    const relativePath = path.relative(process.cwd(), finding.filePath);
    console.error(
      `- ${relativePath}:${finding.line}:${finding.column} prisma.${finding.model}.${finding.action} missing ${finding.scopeField}`,
    );
  }
  console.error(`Use "${INLINE_IGNORE_TOKEN}" only for explicit cross-tenant cases.`);
  process.exit(1);
};

void run();
