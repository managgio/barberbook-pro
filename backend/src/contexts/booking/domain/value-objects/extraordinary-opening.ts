import {
  DaySchedule,
  ExtraordinaryOpening,
  ExtraordinaryOpeningsByDate,
  ShiftSchedule,
} from './schedule';

const ISO_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isISODateOnly = (value: string): boolean => {
  if (!ISO_DATE_KEY_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
};

const timeToMinutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const normalizeShift = (value: unknown): ShiftSchedule => {
  const source = value && typeof value === 'object'
    ? value as Partial<ShiftSchedule>
    : {};
  const enabled = source.enabled === true;
  const start = typeof source.start === 'string' && TIME_REGEX.test(source.start)
    ? source.start
    : '00:00';
  const end = typeof source.end === 'string' && TIME_REGEX.test(source.end)
    ? source.end
    : '00:00';

  return {
    enabled: enabled && timeToMinutes(start) < timeToMinutes(end),
    start,
    end,
  };
};

const normalizeOpening = (value: unknown): ExtraordinaryOpening | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<ExtraordinaryOpening>;
  const morning = normalizeShift(source.morning);
  const afternoon = normalizeShift(source.afternoon);
  if (!morning.enabled && !afternoon.enabled) return null;
  if (
    morning.enabled
    && afternoon.enabled
    && timeToMinutes(morning.end) > timeToMinutes(afternoon.start)
  ) {
    return null;
  }

  const allProfessionals = source.allProfessionals === true;
  const barberIds = allProfessionals
    ? []
    : Array.from(new Set(
      Array.isArray(source.barberIds)
        ? source.barberIds
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
        : [],
    )).slice(0, 200);
  if (!allProfessionals && barberIds.length === 0) return null;

  const name = typeof source.name === 'string'
    ? source.name.trim().slice(0, 80)
    : '';

  return {
    ...(name ? { name } : {}),
    allProfessionals,
    barberIds,
    morning,
    afternoon,
  };
};

export const normalizeExtraordinaryOpenings = (input: unknown): ExtraordinaryOpeningsByDate => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const normalized: ExtraordinaryOpeningsByDate = {};
  Object.entries(input as Record<string, unknown>).forEach(([dateOnly, value]) => {
    if (!isISODateOnly(dateOnly)) return;
    const opening = normalizeOpening(value);
    if (opening) normalized[dateOnly] = opening;
  });
  return normalized;
};

export const resolveExtraordinaryOpening = (params: {
  openings: ExtraordinaryOpeningsByDate | null | undefined;
  dateOnly: string;
  barberId: string;
}): ExtraordinaryOpening | null => {
  const opening = params.openings?.[params.dateOnly];
  if (!opening) return null;
  if (opening.allProfessionals || opening.barberIds.includes(params.barberId)) {
    return opening;
  }
  return null;
};

export const extraordinaryOpeningToDaySchedule = (
  opening: ExtraordinaryOpening,
): DaySchedule => ({
  closed: false,
  morning: { ...opening.morning },
  afternoon: { ...opening.afternoon },
});
