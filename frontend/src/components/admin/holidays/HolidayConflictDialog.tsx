import { AlertTriangle, Loader2, MailWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HolidayAppointmentImpact, HolidayRange } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';

export type PendingHoliday = {
  type: 'general' | 'barber';
  range: HolidayRange;
  barberId?: string;
  impact: HolidayAppointmentImpact;
};

type HolidayConflictDialogProps = {
  pendingHoliday: PendingHoliday | null;
  action: 'checking' | 'saving' | 'notifying' | null;
  onClose: () => void;
  onSaveWithoutNotification: () => void;
  onNotifyAndCancel: () => void;
};

export const HolidayConflictDialog = ({
  pendingHoliday,
  action,
  onClose,
  onSaveWithoutNotification,
  onNotifyAndCancel,
}: HolidayConflictDialogProps) => {
  const { t } = useI18n();

  return (
    <Dialog
      open={Boolean(pendingHoliday)}
      onOpenChange={(open) => {
        if (!open && !action) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('admin.holidays.conflict.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.holidays.conflict.description', {
              appointments: pendingHoliday?.impact.appointmentsAffected ?? 0,
              clients: pendingHoliday?.impact.clientsAffected ?? 0,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p>{t('admin.holidays.conflict.optionsHint')}</p>
          {(pendingHoliday?.impact.withoutEmail ?? 0) > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t('admin.holidays.conflict.withoutEmail', {
                  count: pendingHoliday?.impact.withoutEmail ?? 0,
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-col sm:items-stretch">
          <Button variant="ghost" onClick={onClose} disabled={Boolean(action)}>
            {t('admin.holidays.conflict.actions.doNotCreate')}
          </Button>
          <Button
            variant="outline"
            onClick={onSaveWithoutNotification}
            disabled={Boolean(action)}
          >
            {action === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('admin.holidays.conflict.actions.createOnly')}
          </Button>
          <Button variant="destructive" onClick={onNotifyAndCancel} disabled={Boolean(action)}>
            {action === 'notifying' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('admin.holidays.conflict.actions.notifyAndCancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
