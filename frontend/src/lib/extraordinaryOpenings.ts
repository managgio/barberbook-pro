import type {
  ExtraordinaryOpening,
  ExtraordinaryOpeningsByDate,
  ShiftSchedule,
} from '@/data/types';

export type ExtraordinaryOpeningDraft = {
  date: string;
  name: string;
  allProfessionals: boolean;
  barberIds: string[];
  morning: ShiftSchedule;
  afternoon: ShiftSchedule;
};

export type ExtraordinaryOpeningValidationError =
  | 'dateRequired'
  | 'dateInvalid'
  | 'shiftRequired'
  | 'morningInvalid'
  | 'afternoonInvalid'
  | 'shiftsOverlap'
  | 'professionalsRequired';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createExtraordinaryOpeningDraft = (date = ''): ExtraordinaryOpeningDraft => ({
  date,
  name: '',
  allProfessionals: true,
  barberIds: [],
  morning: { enabled: true, start: '09:00', end: '14:00' },
  afternoon: { enabled: true, start: '16:00', end: '20:00' },
});

const isValidDateOnly = (value: string) => {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
};

const isValidShift = (shift: ShiftSchedule) => {
  if (!shift.enabled) return true;
  if (!TIME_REGEX.test(shift.start) || !TIME_REGEX.test(shift.end)) return false;
  return shift.start < shift.end;
};

export const validateExtraordinaryOpeningDraft = (
  draft: ExtraordinaryOpeningDraft,
): ExtraordinaryOpeningValidationError | null => {
  if (!draft.date) return 'dateRequired';
  if (!isValidDateOnly(draft.date)) return 'dateInvalid';
  if (!draft.morning.enabled && !draft.afternoon.enabled) return 'shiftRequired';
  if (!isValidShift(draft.morning)) return 'morningInvalid';
  if (!isValidShift(draft.afternoon)) return 'afternoonInvalid';
  if (
    draft.morning.enabled
    && draft.afternoon.enabled
    && draft.morning.end > draft.afternoon.start
  ) {
    return 'shiftsOverlap';
  }
  if (!draft.allProfessionals && draft.barberIds.length === 0) {
    return 'professionalsRequired';
  }
  return null;
};

export const draftToExtraordinaryOpening = (
  draft: ExtraordinaryOpeningDraft,
): ExtraordinaryOpening => {
  const name = draft.name.trim().slice(0, 80);
  return {
    ...(name ? { name } : {}),
    allProfessionals: draft.allProfessionals,
    barberIds: draft.allProfessionals
      ? []
      : Array.from(new Set(draft.barberIds.filter(Boolean))),
    morning: { ...draft.morning },
    afternoon: { ...draft.afternoon },
  };
};

export const openingToDraft = (
  date: string,
  opening: ExtraordinaryOpening,
): ExtraordinaryOpeningDraft => ({
  date,
  name: opening.name ?? '',
  allProfessionals: opening.allProfessionals,
  barberIds: [...opening.barberIds],
  morning: { ...opening.morning },
  afternoon: { ...opening.afternoon },
});

export const upsertExtraordinaryOpening = (params: {
  openings: ExtraordinaryOpeningsByDate;
  originalDate?: string | null;
  draft: ExtraordinaryOpeningDraft;
}): ExtraordinaryOpeningsByDate => {
  const next = { ...params.openings };
  if (params.originalDate && params.originalDate !== params.draft.date) {
    delete next[params.originalDate];
  }
  next[params.draft.date] = draftToExtraordinaryOpening(params.draft);
  return next;
};

export const removeExtraordinaryOpening = (
  openings: ExtraordinaryOpeningsByDate,
  date: string,
): ExtraordinaryOpeningsByDate => {
  const next = { ...openings };
  delete next[date];
  return next;
};
