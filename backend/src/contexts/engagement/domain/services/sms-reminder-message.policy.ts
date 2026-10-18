import {
  analyzeSmsSegmentation,
  countGsm7CharacterSeptets,
  countGsm7Septets,
} from './sms-segmentation.policy';

const MAX_CONCATENATED_SEGMENT_SEPTETS = 153;
const MAX_REMINDER_SEGMENTS = 2;
const MAX_REMINDER_SEPTETS = MAX_CONCATENATED_SEGMENT_SEPTETS * MAX_REMINDER_SEGMENTS;

const normalizePunctuation = (value: string) => value
  .replace(/[\u2013\u2014\u2212]/g, '-')
  .replace(/[“”«»]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/…/g, '...')
  .replace(/\u00a0/g, ' ');

export const toGsm7SafeText = (value?: string | null) => {
  const normalized = normalizePunctuation(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  let safe = '';
  for (const character of normalized) {
    if (countGsm7CharacterSeptets(character) !== null) {
      safe += character;
    } else {
      safe += ' ';
    }
  }
  return safe.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
};

const truncateToSeptets = (value: string, maxSeptets: number) => {
  if (maxSeptets <= 0) return '';
  const current = countGsm7Septets(value) || 0;
  if (current <= maxSeptets) return value;
  const ellipsis = maxSeptets >= 3 ? '...' : '';
  const contentBudget = maxSeptets - ellipsis.length;
  let result = '';
  let used = 0;
  for (const character of value) {
    const cost = countGsm7CharacterSeptets(character) || 1;
    if (used + cost > contentBudget) break;
    result += character;
    used += cost;
  }
  return `${result.trimEnd()}${ellipsis}`;
};

const resolveManagementClause = (managementUrl?: string | null) => {
  const candidate = managementUrl?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const normalized = toGsm7SafeText(url.toString());
    return normalized.length <= 120 ? ` Gestiona tu cita: ${normalized}.` : null;
  } catch {
    return null;
  }
};

export type SmsReminderMessage = {
  body: string;
  encoding: 'GSM-7';
  septets: number;
  segments: number;
};

export const buildSmsReminderMessage = (input: {
  brandName: string;
  formattedDate: string;
  serviceName?: string | null;
  managementUrl?: string | null;
}): SmsReminderMessage => {
  const brand = truncateToSeptets(toGsm7SafeText(input.brandName) || 'Managgio', 40);
  const date = truncateToSeptets(toGsm7SafeText(input.formattedDate), 36);
  const serviceName = toGsm7SafeText(input.serviceName);
  const prefix = `${brand}: recuerda tu cita el ${date}.`;
  const managementClause = resolveManagementClause(input.managementUrl);
  const actionClause = managementClause || ' Si no puedes asistir, contacta con el centro.';
  const suffix = `${actionClause} No respondas a este SMS.`;
  const servicePrefix = serviceName ? ' Servicios: ' : '';
  const serviceSuffix = serviceName ? '.' : '';
  const fixedSeptets = countGsm7Septets(`${prefix}${servicePrefix}${serviceSuffix}${suffix}`) || 0;
  const availableServiceSeptets = Math.max(0, MAX_REMINDER_SEPTETS - fixedSeptets);
  const service = truncateToSeptets(serviceName, availableServiceSeptets);
  const body = `${prefix}${service ? `${servicePrefix}${service}${serviceSuffix}` : ''}${suffix}`;
  const septets = countGsm7Septets(body) || 0;

  return {
    body,
    encoding: 'GSM-7',
    septets,
    segments: analyzeSmsSegmentation(body).segments,
  };
};
