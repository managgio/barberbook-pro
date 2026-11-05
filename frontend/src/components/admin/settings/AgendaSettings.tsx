import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';
import type { ShopSchedule } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/hooks/useI18n';
import { isValidScheduleDraft } from '@/lib/scheduleSettings';
import ClosingRulesEditor from './agenda/ClosingRulesEditor';
import MinutesControl from './agenda/MinutesControl';
import ScheduleBreaksEditor from './agenda/ScheduleBreaksEditor';
import WeeklyHoursEditor from './agenda/WeeklyHoursEditor';
import { useAgendaDraft } from './agenda/useAgendaDraft';
import AgendaSaveActions from './agenda/AgendaSaveActions';
import SectionInfo from './agenda/SectionInfo';

type Props = {
  localId: string | null;
  schedule?: ShopSchedule;
  openingHours?: ShopSchedule;
  isLoading: boolean;
  isSaving: boolean;
  loadFailed: boolean;
  permissionDenied?: boolean;
  actionsContainer?: HTMLElement | null;
  onRetry: () => void;
  onSave: (schedule: ShopSchedule) => Promise<ShopSchedule>;
};

export default function AgendaSettings({ localId, schedule, openingHours, isLoading, isSaving, loadFailed, permissionDenied, actionsContainer, onRetry, onSave }: Props) {
  const { t } = useI18n();
  const { draft, dirty, update, discard, acceptSaved } = useAgendaDraft(localId, schedule, openingHours);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const currentLocation = useRef(localId);
  currentLocation.current = localId;
  const valid = draft ? isValidScheduleDraft(draft) : false;
  const change = (next: ShopSchedule) => { setSaved(false); setSaveError(null); update(next); };
  const save = async () => {
    if (!draft || !dirty || !valid || isSaving || loadFailed) return;
    const scope = localId;
    setSaveError(null);
    try {
      const result = await onSave(draft);
      if (currentLocation.current !== scope) return;
      acceptSaved(result, scope); setSaved(true);
    } catch (error) {
      if (currentLocation.current !== scope) return;
      setSaveError(error instanceof Error ? error.message : t('admin.settings.toast.genericSaveError'));
    }
  };

  if (permissionDenied) {
    return <p role="alert" className="py-8 text-sm text-muted-foreground">{t('admin.settings.agenda.permissionDenied')}</p>;
  }
  if (isLoading || !draft) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground" role={loadFailed ? 'alert' : 'status'}>
        {loadFailed ? <div className="space-y-3 text-center">
          <p>{t('admin.settings.toast.loadAvailabilityErrorTitle')}</p>
          <Button type="button" variant="outline" onClick={onRetry}>{t('admin.settings.agenda.retry')}</Button>
        </div> : <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t('admin.settings.loading')}</>}
      </div>
    );
  }
  const actions = (
    <AgendaSaveActions dirty={dirty} disabled={!dirty || !valid || isSaving || loadFailed}
      saving={isSaving} onSave={() => void save()} onDiscard={() => {
        discard(); setSaveError(null); setSaved(false);
      }} />
  );
  return (
    <div className="max-w-6xl space-y-4">
      {actionsContainer ? createPortal(actions, actionsContainer) : actions}
      <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        {saved && !dirty && <Check className="h-4 w-4" aria-hidden="true" />}
        {isSaving ? t('admin.settings.agenda.saving')
          : dirty ? t('admin.settings.agenda.pending')
            : saved ? t('admin.settings.agenda.saved') : t('admin.settings.agenda.noChanges')}
      </span>
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      {!valid && <p role="alert" className="text-sm text-destructive">{t('admin.settings.agenda.invalidDraft')}</p>}
      {loadFailed && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
        <span>{t('admin.settings.agenda.refreshFailed')}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t('admin.settings.agenda.retry')}</Button>
      </div>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]">
        <WeeklyHoursEditor value={draft} disabled={isSaving} onChange={change} />
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="p-4 pb-0">
              <div className="flex items-center gap-1">
                <CardTitle className="text-base">{t('admin.settings.agenda.bufferTitle')}</CardTitle>
                <SectionInfo title={t('admin.settings.agenda.bufferTitle')}
                  description={t('admin.settings.agenda.bufferHelp')} example={t('admin.settings.agenda.bufferExample')} />
              </div>
              <p className="text-sm text-muted-foreground">{t('admin.settings.agenda.bufferDescription')}</p>
            </CardHeader>
            <CardContent className="p-4">
              <MinutesControl label={t('admin.settings.agenda.bufferLabel')} value={draft.bufferMinutes}
                onChange={(minutes) => change({ ...draft, bufferMinutes: minutes })} presets disabled={isSaving} />
            </CardContent>
          </Card>
          <ScheduleBreaksEditor value={draft} onChange={change} disabled={isSaving} />
          <ClosingRulesEditor value={draft} onChange={change} disabled={isSaving} />
        </div>
      </div>
    </div>
  );
}
