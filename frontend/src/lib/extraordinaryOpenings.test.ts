import { describe, expect, it } from 'vitest';

import {
  createExtraordinaryOpeningDraft,
  removeExtraordinaryOpening,
  resolveExtraordinaryOpeningProfessionalScope,
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

  it('assigns an opening to the only active professional', () => {
    const draft = createExtraordinaryOpeningDraft('2026-10-05');

    const resolved = resolveExtraordinaryOpeningProfessionalScope(draft, ['barber-1']);

    expect(resolved).toMatchObject({
      allProfessionals: false,
      barberIds: ['barber-1'],
    });
    expect(draft).toMatchObject({
      allProfessionals: true,
      barberIds: [],
    });
  });

  it('keeps the chosen scope when the location does not have exactly one professional', () => {
    const draft = createExtraordinaryOpeningDraft('2026-10-05');

    expect(resolveExtraordinaryOpeningProfessionalScope(draft, [])).toBe(draft);
    expect(resolveExtraordinaryOpeningProfessionalScope(draft, ['barber-1', 'barber-2']))
      .toBe(draft);
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
