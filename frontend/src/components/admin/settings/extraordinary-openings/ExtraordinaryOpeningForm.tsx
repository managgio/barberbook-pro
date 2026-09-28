import React from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';

import type {
  Barber,
  ExtraordinaryOpeningConflictSummary,
  ShiftSchedule,
} from '@/data/types';
import type { ExtraordinaryOpeningDraft } from '@/lib/extraordinaryOpenings';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

type ExtraordinaryOpeningFormProps = {
  draft: ExtraordinaryOpeningDraft;
  editingDate: string | null;
  today: string;
  activeBarbers: Barber[];
  hideProfessionalSelection: boolean;
  isProfessionalsLoading: boolean;
  professionalsLoadFailed: boolean;
  isSaving: boolean;
  validationError: string | null;
  conflict?: ExtraordinaryOpeningConflictSummary;
  isCheckingConflicts: boolean;
  conflictCheckFailed: boolean;
  holidayNames: string[];
  closureNames: string[];
  onDraftChange: (draft: ExtraordinaryOpeningDraft) => void;
  onValidationClear: () => void;
  onSave: () => void;
  onCancel: () => void;
};

const ShiftEditor: React.FC<{
  label: string;
  shift: ShiftSchedule;
  disabled: boolean;
  onChange: (shift: ShiftSchedule) => void;
}> = ({ label, shift, disabled, onChange }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Switch
          checked={shift.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange({ ...shift, enabled })}
          aria-label={label}
        />
      </div>
      {shift.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('admin.settings.extraordinary.start')}
            </Label>
            <Input
              type="time"
              value={shift.start}
              disabled={disabled}
              onChange={(event) => onChange({ ...shift, start: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('admin.settings.extraordinary.end')}
            </Label>
            <Input
              type="time"
              value={shift.end}
              disabled={disabled}
              onChange={(event) => onChange({ ...shift, end: event.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ExtraordinaryOpeningForm: React.FC<ExtraordinaryOpeningFormProps> = ({
  draft,
  editingDate,
  today,
  activeBarbers,
  hideProfessionalSelection,
  isProfessionalsLoading,
  professionalsLoadFailed,
  isSaving,
  validationError,
  conflict,
  isCheckingConflicts,
  conflictCheckFailed,
  holidayNames,
  closureNames,
  onDraftChange,
  onValidationClear,
  onSave,
  onCancel,
}) => {
  const { t } = useI18n();
  const hasConflicts = Boolean(
    conflict?.generalHoliday
    || conflict?.generalClosure
    || holidayNames.length > 0
    || closureNames.length > 0,
  );
  const updateDraft = (patch: Partial<ExtraordinaryOpeningDraft>) => {
    onDraftChange({ ...draft, ...patch });
    onValidationClear();
  };
  const updateShift = (key: 'morning' | 'afternoon', shift: ShiftSchedule) => {
    updateDraft({ [key]: shift });
  };
  const toggleBarber = (barberId: string, checked: boolean) => {
    updateDraft({
      barberIds: checked
        ? Array.from(new Set([...draft.barberIds, barberId]))
        : draft.barberIds.filter((id) => id !== barberId),
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>
          {editingDate
            ? t('admin.settings.extraordinary.editTitle')
            : t('admin.settings.extraordinary.createTitle')}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4" />
          <span className="sr-only">{t('admin.settings.extraordinary.cancel')}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="extraordinary-opening-date">
              {t('admin.settings.extraordinary.date')}
            </Label>
            <Input
              id="extraordinary-opening-date"
              type="date"
              min={today}
              value={draft.date}
              disabled={isSaving}
              onChange={(event) => updateDraft({ date: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extraordinary-opening-name">
              {t('admin.settings.extraordinary.name')}
            </Label>
            <Input
              id="extraordinary-opening-name"
              maxLength={80}
              value={draft.name}
              disabled={isSaving}
              placeholder={t('admin.settings.extraordinary.namePlaceholder')}
              onChange={(event) => updateDraft({ name: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t('admin.settings.extraordinary.nameHint')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ShiftEditor
            label={t('admin.settings.extraordinary.morning')}
            shift={draft.morning}
            disabled={isSaving}
            onChange={(shift) => updateShift('morning', shift)}
          />
          <ShiftEditor
            label={t('admin.settings.extraordinary.afternoon')}
            shift={draft.afternoon}
            disabled={isSaving}
            onChange={(shift) => updateShift('afternoon', shift)}
          />
        </div>

        {!hideProfessionalSelection && (
          <div className="space-y-3">
            <Label>{t('admin.settings.extraordinary.professionals')}</Label>
            <RadioGroup
              value={draft.allProfessionals ? 'all' : 'selected'}
              onValueChange={(value) => updateDraft({ allProfessionals: value === 'all' })}
              className="grid gap-3 md:grid-cols-2"
            >
              <Label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-4">
                <RadioGroupItem value="all" className="mt-0.5" disabled={isSaving} />
                <span>
                  <span className="block font-medium">
                    {t('admin.settings.extraordinary.allProfessionals')}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {t('admin.settings.extraordinary.allProfessionalsHint')}
                  </span>
                </span>
              </Label>
              <Label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-4">
                <RadioGroupItem value="selected" className="mt-0.5" disabled={isSaving} />
                <span>
                  <span className="block font-medium">
                    {t('admin.settings.extraordinary.selectedProfessionals')}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {t('admin.settings.extraordinary.selectedProfessionalsHint')}
                  </span>
                </span>
              </Label>
            </RadioGroup>

            {!draft.allProfessionals && (
              <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {isProfessionalsLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('admin.settings.extraordinary.loadingProfessionals')}
                  </div>
                )}
                {professionalsLoadFailed && (
                  <p className="text-sm text-destructive">
                    {t('admin.settings.extraordinary.professionalsLoadError')}
                  </p>
                )}
                {!isProfessionalsLoading
                  && !professionalsLoadFailed
                  && activeBarbers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.settings.extraordinary.noProfessionals')}
                    </p>
                )}
                {activeBarbers.map((barber) => (
                  <Label
                    key={barber.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-background/80 p-3"
                  >
                    <Checkbox
                      checked={draft.barberIds.includes(barber.id)}
                      disabled={isSaving}
                      onCheckedChange={(checked) => toggleBarber(barber.id, checked === true)}
                    />
                    <span>{barber.name}</span>
                  </Label>
                ))}
              </div>
            )}
          </div>
        )}

        {isCheckingConflicts && (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('admin.settings.extraordinary.checkingConflicts')}
          </div>
        )}
        {conflictCheckFailed && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t('admin.settings.extraordinary.conflictsCheckError')}
          </div>
        )}
        {hasConflicts && (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('admin.settings.extraordinary.conflictsTitle')}
            </div>
            <ul className="list-disc space-y-1 pl-6">
              {conflict?.generalHoliday && (
                <li>{t('admin.settings.extraordinary.generalHolidayConflict')}</li>
              )}
              {conflict?.generalClosure && (
                <li>{t('admin.settings.extraordinary.generalClosureConflict')}</li>
              )}
              {holidayNames.length > 0 && (
                <li>{t('admin.settings.extraordinary.professionalHolidayConflict', {
                  names: holidayNames.join(', '),
                })}</li>
              )}
              {closureNames.length > 0 && (
                <li>{t('admin.settings.extraordinary.professionalClosureConflict', {
                  names: closureNames.join(', '),
                })}</li>
              )}
            </ul>
            <p>{t('admin.settings.extraordinary.conflictsExplanation')}</p>
          </div>
        )}

        {validationError && (
          <p role="alert" className="text-sm text-destructive">{validationError}</p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {t('admin.settings.extraordinary.cancel')}
          </Button>
          <Button onClick={onSave} disabled={isSaving || isProfessionalsLoading} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('admin.settings.extraordinary.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExtraordinaryOpeningForm;
