import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUTPUT_PATH = join(ROOT, 'docs/migration/transition-artifacts-checklist.md');
const CHECK_MODE = process.argv.includes('--check');
const REQUIRE_ZERO_PRESENT = process.argv.includes('--require-zero-present');

const FILE_ARTIFACTS = [
  {
    id: 'MIG-LEGACY-APPOINTMENTS-BRIDGE',
    phase: 'PR20',
    type: 'legacy-bridge',
    path: 'src/modules/appointments/appointments.legacy.service.ts',
    note: 'Bridge principal del strangler en appointments.',
  },
  {
    id: 'MIG-LEGACY-BOOKING-COMMAND',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/booking/infrastructure/adapters/legacy-booking-command.adapter.ts',
    note: 'Delega command port al service legacy.',
  },
  {
    id: 'MIG-LEGACY-BOOKING-MAINTENANCE',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/booking/infrastructure/adapters/legacy-booking-maintenance.adapter.ts',
    note: 'Delega maintenance port al service legacy.',
  },
  {
    id: 'MIG-LEGACY-BOOKING-SIDE-EFFECTS',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/booking/infrastructure/adapters/legacy-booking-status-side-effects.adapter.ts',
    note: 'Orquestación de side-effects heredada.',
  },
  {
    id: 'MIG-LEGACY-BOOKING-UOW',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/booking/infrastructure/adapters/legacy-booking-unit-of-work.adapter.ts',
    note: 'UoW puente mientras convive create/update legacy.',
  },
  {
    id: 'MIG-LEGACY-COMMERCE-SUBSCRIPTION',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/commerce/infrastructure/adapters/legacy-commerce-subscription-policy.adapter.ts',
    note: 'ACL de suscripciones sobre service legacy.',
  },
  {
    id: 'MIG-LEGACY-COMMERCE-LOYALTY',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/commerce/infrastructure/adapters/legacy-commerce-loyalty-policy.adapter.ts',
    note: 'ACL de loyalty sobre service legacy.',
  },
  {
    id: 'MIG-LEGACY-COMMERCE-WALLET',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/commerce/infrastructure/adapters/legacy-commerce-wallet-ledger.adapter.ts',
    note: 'ACL wallet/coupon sobre rewards legacy.',
  },
  {
    id: 'MIG-LEGACY-ENGAGEMENT-ATTRIBUTION',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/engagement/infrastructure/adapters/legacy-engagement-referral-attribution.adapter.ts',
    note: 'Puente attribution mientras se cierra core engagement.',
  },
  {
    id: 'MIG-LEGACY-ENGAGEMENT-REWARD',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/engagement/infrastructure/adapters/legacy-engagement-referral-reward.adapter.ts',
    note: 'Puente emisión de recompensas legacy.',
  },
  {
    id: 'MIG-LEGACY-ENGAGEMENT-NOTIFICATION',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/engagement/infrastructure/adapters/legacy-engagement-referral-notification.adapter.ts',
    note: 'Puente notificaciones de referidos legacy.',
  },
  {
    id: 'MIG-LEGACY-AI-BOOKING-TOOLS',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/ai-orchestration/infrastructure/adapters/legacy-ai-booking-tool.adapter.ts',
    note: 'Tool adapter legacy para booking en IA.',
  },
  {
    id: 'MIG-LEGACY-AI-HOLIDAY-TOOLS',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/ai-orchestration/infrastructure/adapters/legacy-ai-holiday-tool.adapter.ts',
    note: 'Tool adapter legacy para holidays en IA.',
  },
  {
    id: 'MIG-LEGACY-AI-ALERT-TOOLS',
    phase: 'PR20',
    type: 'legacy-adapter',
    path: 'src/contexts/ai-orchestration/infrastructure/adapters/legacy-ai-alert-tool.adapter.ts',
    note: 'Tool adapter legacy para alerts en IA.',
  },
];

const FLAG_ALIASES = [
  {
    id: 'MIG-FLAG-ALIAS-BOOKING-AVAILABILITY',
    phase: 'PR20',
    type: 'flag-alias',
    file: 'src/modules/appointments/appointments.flags.ts',
    env: 'BOOKING_AVAILABILITY_MODE',
    note: 'Alias legacy global; sustituir por capability flags.',
  },
  {
    id: 'MIG-FLAG-ALIAS-BOOKING-CREATE',
    phase: 'PR20',
    type: 'flag-alias',
    file: 'src/modules/appointments/appointments.flags.ts',
    env: 'BOOKING_CREATE_MODE',
    note: 'Alias legacy para create.',
  },
  {
    id: 'MIG-FLAG-ALIAS-BOOKING-UPDATE',
    phase: 'PR20',
    type: 'flag-alias',
    file: 'src/modules/appointments/appointments.flags.ts',
    env: 'BOOKING_UPDATE_MODE',
    note: 'Alias legacy para update.',
  },
  {
    id: 'MIG-FLAG-ALIAS-BOOKING-REMOVE',
    phase: 'PR20',
    type: 'flag-alias',
    file: 'src/modules/appointments/appointments.flags.ts',
    env: 'BOOKING_REMOVE_MODE',
    note: 'Alias legacy para remove.',
  },
];

const loadFile = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8');

const fileArtifacts = FILE_ARTIFACTS.map((item) => {
  const present = existsSync(join(ROOT, item.path));
  return {
    ...item,
    status: present ? 'present' : 'removed',
  };
});

const flagArtifacts = FLAG_ALIASES.map((item) => {
  const source = existsSync(join(ROOT, item.file)) ? loadFile(item.file) : '';
  const present = source.includes(item.env);
  return {
    ...item,
    status: present ? 'present' : 'removed',
  };
});

const allArtifacts = [...fileArtifacts, ...flagArtifacts];
const total = allArtifacts.length;
const presentCount = allArtifacts.filter((item) => item.status === 'present').length;
const removedCount = total - presentCount;
const generatedAt = new Date().toISOString();

const buildChecklistContent = () => {
  const lines = [];
  lines.push('# Transition Artifacts Checklist');
  lines.push('');
  lines.push(`- Generated: ${generatedAt}`);
  lines.push(`- Total artifacts tracked: ${total}`);
  lines.push(`- Present: ${presentCount}`);
  lines.push(`- Removed: ${removedCount}`);
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- This file is generated; do not edit manually.');
  lines.push('- Mark removal by deleting the artifact in code and regenerating.');
  lines.push('- PRs that remove artifacts must update roadmap + this checklist in the same commit.');
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push('| Status | ID | Type | Delete Phase | Artifact | Notes |');
  lines.push('|---|---|---|---|---|---|');
  allArtifacts.forEach((item) => {
    const status = item.status === 'present' ? '☐ present' : '☑ removed';
    const artifact = item.type === 'flag-alias' ? `${item.file} (${item.env})` : item.path;
    lines.push(`| ${status} | ${item.id} | ${item.type} | ${item.phase} | \`${artifact}\` | ${item.note} |`);
  });
  lines.push('');
  lines.push('## Regeneration');
  lines.push('');
  lines.push('- Command: `npm run migration:inventory:transition-artifacts`');
  lines.push('');
  return `${lines.join('\n')}\n`;
};

const normalizeForCheck = (content) =>
  content.replace(/^- Generated: .*\n/m, '- Generated: <normalized>\n');

const nextContent = buildChecklistContent();

if (!CHECK_MODE) {
  writeFileSync(OUTPUT_PATH, nextContent, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  process.exit(0);
}

if (!existsSync(OUTPUT_PATH)) {
  console.error(`Missing ${OUTPUT_PATH}. Run npm run migration:inventory:transition-artifacts`);
  process.exit(1);
}

const currentContent = readFileSync(OUTPUT_PATH, 'utf8');
const isSynced = normalizeForCheck(currentContent) === normalizeForCheck(nextContent);
if (!isSynced) {
  console.error('Transition artifacts checklist is out of date.');
  console.error('Run npm run migration:inventory:transition-artifacts and commit the result.');
  process.exit(1);
}

if (REQUIRE_ZERO_PRESENT && presentCount > 0) {
  console.error(`Transition artifacts checklist has present artifacts: ${presentCount}`);
  console.error('Remove remaining migration artifacts before merging.');
  process.exit(1);
}

console.log('Transition artifacts checklist is up to date.');
