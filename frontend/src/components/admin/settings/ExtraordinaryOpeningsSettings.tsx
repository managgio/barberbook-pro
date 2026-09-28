import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2, Plus } from 'lucide-react';

import {
  getExtraordinaryOpeningConflicts,
  updateExtraordinaryOpenings,
} from '@/data/api/schedules';
import type {
  ExtraordinaryOpening,
  ExtraordinaryOpeningsByDate,
} from '@/data/types';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import { fetchBarbersCached } from '@/lib/catalogQuery';
import { dispatchSchedulesUpdated } from '@/lib/adminEvents';
import {
  createExtraordinaryOpeningDraft,
  ExtraordinaryOpeningDraft,
  ExtraordinaryOpeningValidationError,
  openingToDraft,
  removeExtraordinaryOpening,
  upsertExtraordinaryOpening,
  validateExtraordinaryOpeningDraft,
} from '@/lib/extraordinaryOpenings';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ExtraordinaryOpeningForm from './extraordinary-openings/ExtraordinaryOpeningForm';
import ExtraordinaryOpeningsList from './extraordinary-openings/ExtraordinaryOpeningsList';

type ExtraordinaryOpeningsSettingsProps = {
  openings: ExtraordinaryOpeningsByDate;
  isLoading: boolean;
  onOpeningsUpdated: (openings: ExtraordinaryOpeningsByDate) => void;
};

const VALIDATION_KEYS: Record<ExtraordinaryOpeningValidationError, string> = {
  dateRequired: 'admin.settings.extraordinary.validation.dateRequired',
  dateInvalid: 'admin.settings.extraordinary.validation.dateInvalid',
  shiftRequired: 'admin.settings.extraordinary.validation.shiftRequired',
  morningInvalid: 'admin.settings.extraordinary.validation.morningInvalid',
  afternoonInvalid: 'admin.settings.extraordinary.validation.afternoonInvalid',
  shiftsOverlap: 'admin.settings.extraordinary.validation.shiftsOverlap',
  professionalsRequired: 'admin.settings.extraordinary.validation.professionalsRequired',
};

const ExtraordinaryOpeningsSettings: React.FC<ExtraordinaryOpeningsSettingsProps> = ({
  openings,
  isLoading,
  onOpeningsUpdated,
}) => {
  const { currentLocationId } = useTenant();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtraordinaryOpeningDraft>(() =>
    createExtraordinaryOpeningDraft(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [datePendingDelete, setDatePendingDelete] = useState<string | null>(null);

  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId, undefined, true),
    queryFn: () => fetchBarbersCached({ localId: currentLocationId, includeInactive: true }),
    enabled: Boolean(currentLocationId),
  });
  const activeBarbers = useMemo(
    () => (barbersQuery.data ?? []).filter((barber) => barber.isActive !== false),
    [barbersQuery.data],
  );
  const barberById = useMemo(
    () => new Map(activeBarbers.map((barber) => [barber.id, barber])),
    [activeBarbers],
  );
  const professionalScope = draft.allProfessionals
    ? 'all'
    : [...draft.barberIds].sort().join(',');
  const conflictsQuery = useQuery({
    queryKey: queryKeys.extraordinaryOpeningConflicts(
      currentLocationId,
      draft.date,
      professionalScope,
    ),
    queryFn: () => getExtraordinaryOpeningConflicts({
      date: draft.date,
      allProfessionals: draft.allProfessionals,
      barberIds: draft.allProfessionals ? [] : draft.barberIds,
    }),
    enabled: Boolean(
      isFormOpen
      && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
      && (draft.allProfessionals || draft.barberIds.length > 0),
    ),
  });

  useEffect(() => {
    setIsFormOpen(false);
    setEditingDate(null);
    setDraft(createExtraordinaryOpeningDraft());
    setValidationError(null);
  }, [currentLocationId]);

  const upcomingOpenings = useMemo(
    () => Object.entries(openings)
      .filter(([date]) => date >= today)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)),
    [openings, today],
  );

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingDate(null);
    setDraft(createExtraordinaryOpeningDraft());
    setValidationError(null);
  };

  const openCreateForm = () => {
    setEditingDate(null);
    setDraft(createExtraordinaryOpeningDraft());
    setValidationError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (date: string, opening: ExtraordinaryOpening) => {
    setEditingDate(date);
    setDraft(openingToDraft(date, opening));
    setValidationError(null);
    setIsFormOpen(true);
  };

  const saveOpening = async () => {
    const error = validateExtraordinaryOpeningDraft(draft);
    if (error) {
      setValidationError(t(VALIDATION_KEYS[error]));
      return;
    }
    if (draft.date < today) {
      setValidationError(t('admin.settings.extraordinary.validation.pastDate'));
      return;
    }
    if (draft.date !== editingDate && openings[draft.date]) {
      setValidationError(t('admin.settings.extraordinary.validation.duplicateDate'));
      return;
    }

    setIsSaving(true);
    try {
      const nextOpenings = upsertExtraordinaryOpening({
        openings,
        originalDate: editingDate,
        draft,
      });
      const updatedSchedule = await updateExtraordinaryOpenings(nextOpenings);
      onOpeningsUpdated(updatedSchedule.extraordinaryOpenings ?? {});
      dispatchSchedulesUpdated({ source: 'admin-settings-extraordinary-openings' });
      toast({
        title: editingDate
          ? t('admin.settings.extraordinary.toast.updatedTitle')
          : t('admin.settings.extraordinary.toast.createdTitle'),
        description: t('admin.settings.extraordinary.toast.savedDescription'),
      });
      resetForm();
    } catch (error) {
      toast({
        title: t('admin.settings.extraordinary.toast.saveErrorTitle'),
        description: error instanceof Error
          ? error.message
          : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOpening = async () => {
    if (!datePendingDelete) return;
    setIsSaving(true);
    try {
      const updatedSchedule = await updateExtraordinaryOpenings(
        removeExtraordinaryOpening(openings, datePendingDelete),
      );
      onOpeningsUpdated(updatedSchedule.extraordinaryOpenings ?? {});
      dispatchSchedulesUpdated({ source: 'admin-settings-extraordinary-openings' });
      toast({
        title: t('admin.settings.extraordinary.toast.deletedTitle'),
        description: t('admin.settings.extraordinary.toast.deletedDescription'),
      });
      if (editingDate === datePendingDelete) resetForm();
      setDatePendingDelete(null);
    } catch (error) {
      toast({
        title: t('admin.settings.extraordinary.toast.deleteErrorTitle'),
        description: error instanceof Error
          ? error.message
          : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const professionalNames = (ids: string[]) => ids
    .map((id) => barberById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  const conflict = conflictsQuery.data;

  return (
    <div className="space-y-6">
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t('admin.settings.extraordinary.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('admin.settings.extraordinary.description')}
            </p>
          </div>
          <Button onClick={openCreateForm} disabled={isLoading || isSaving} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('admin.settings.extraordinary.add')}
          </Button>
        </CardHeader>
      </Card>

      {isFormOpen && (
        <ExtraordinaryOpeningForm
          draft={draft}
          editingDate={editingDate}
          today={today}
          activeBarbers={activeBarbers}
          isProfessionalsLoading={barbersQuery.isLoading}
          professionalsLoadFailed={Boolean(barbersQuery.error)}
          isSaving={isSaving}
          validationError={validationError}
          conflict={conflict}
          isCheckingConflicts={conflictsQuery.isLoading}
          conflictCheckFailed={Boolean(conflictsQuery.error)}
          holidayNames={professionalNames(conflict?.barberHolidayIds ?? [])}
          closureNames={professionalNames(conflict?.barberClosureIds ?? [])}
          onDraftChange={setDraft}
          onValidationClear={() => setValidationError(null)}
          onSave={() => void saveOpening()}
          onCancel={resetForm}
        />
      )}

      <ExtraordinaryOpeningsList
        openings={upcomingOpenings}
        isLoading={isLoading}
        isSaving={isSaving}
        language={language}
        resolveProfessionalNames={professionalNames}
        onEdit={openEditForm}
        onDelete={setDatePendingDelete}
      />

      <AlertDialog
        open={Boolean(datePendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isSaving) setDatePendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.settings.extraordinary.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.settings.extraordinary.deleteDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              {t('admin.settings.extraordinary.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteOpening();
              }}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.settings.extraordinary.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExtraordinaryOpeningsSettings;
