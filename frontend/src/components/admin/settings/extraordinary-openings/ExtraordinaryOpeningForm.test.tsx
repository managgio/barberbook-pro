import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExtraordinaryOpeningDraft } from '@/lib/extraordinaryOpenings';
import ExtraordinaryOpeningForm from './ExtraordinaryOpeningForm';

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('ExtraordinaryOpeningForm', () => {
  it('hides professional selection when the location has only one professional', () => {
    const draft = createExtraordinaryOpeningDraft('2026-10-05');
    draft.allProfessionals = false;
    draft.barberIds = ['barber-1'];

    render(
      <ExtraordinaryOpeningForm
        draft={draft}
        editingDate={null}
        today="2026-09-28"
        activeBarbers={[]}
        hideProfessionalSelection
        isProfessionalsLoading={false}
        professionalsLoadFailed={false}
        isSaving={false}
        validationError={null}
        isCheckingConflicts={false}
        conflictCheckFailed={false}
        holidayNames={[]}
        closureNames={[]}
        onDraftChange={vi.fn()}
        onValidationClear={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText('admin.settings.extraordinary.professionals'))
      .not.toBeInTheDocument();
    expect(screen.queryByText('admin.settings.extraordinary.allProfessionals'))
      .not.toBeInTheDocument();
  });
});
