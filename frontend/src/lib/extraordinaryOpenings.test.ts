import { describe, expect, it } from 'vitest';

import {
  createExtraordinaryOpeningDraft,
  removeExtraordinaryOpening,
  upsertExtraordinaryOpening,
  validateExtraordinaryOpeningDraft,
} from '@/lib/extraordinaryOpenings';

describe('extraordinary openings', () => {
  it('requires at least one valid shift and a professional scope', () => {
    const draft = createExtraordinaryOpeningDraft('2026-10-05');
    draft.morning.enabled = false;
    draft.afternoon.enabled = false;
    expect(validateExtraordinaryOpeningDraft(draft)).toBe('shiftRequired');

    draft.morning.enabled = true;
    draft.allProfessionals = false;
    expect(validateExtraordinaryOpeningDraft(draft)).toBe('professionalsRequired');
  });

  it('rejects overlapping shifts', () => {
    const draft = createExtraordinaryOpeningDraft('2026-10-05');
    draft.morning.end = '17:00';
    draft.afternoon.start = '16:00';
    expect(validateExtraordinaryOpeningDraft(draft)).toBe('shiftsOverlap');
  });

  it('moves an edited opening when its date changes and keeps its selected professionals', () => {
    const original = createExtraordinaryOpeningDraft('2026-10-05');
    original.allProfessionals = false;
    original.barberIds = ['barber-1'];
    const initial = upsertExtraordinaryOpening({ openings: {}, draft: original });

    const edited = { ...original, date: '2026-10-12', name: 'Apertura especial' };
    const updated = upsertExtraordinaryOpening({
      openings: initial,
      originalDate: '2026-10-05',
      draft: edited,
    });

    expect(updated['2026-10-05']).toBeUndefined();
    expect(updated['2026-10-12']).toMatchObject({
      name: 'Apertura especial',
      allProfessionals: false,
      barberIds: ['barber-1'],
    });
    expect(removeExtraordinaryOpening(updated, '2026-10-12')).toEqual({});
  });
});
