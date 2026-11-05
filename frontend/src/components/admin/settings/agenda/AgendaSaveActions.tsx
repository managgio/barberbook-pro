import { Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';

export default function AgendaSaveActions({ dirty, disabled, saving, onSave, onDiscard }: {
  dirty: boolean;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {dirty && <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard}>
        {t('admin.settings.agenda.discard')}
      </Button>}
      <Button type="button" disabled={disabled} onClick={onSave}>
        {saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        <Settings aria-hidden="true" />{t('admin.settings.saveChanges')}
      </Button>
    </div>
  );
}
