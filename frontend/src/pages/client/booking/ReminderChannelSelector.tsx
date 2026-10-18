import { BellRing, MessageCircle, MessageSquareText } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

import {
  type ReminderChannel,
  toggleReminderChannel,
} from './reminderChannels';

type ReminderChannelSelectorProps = {
  availableChannels: readonly ReminderChannel[];
  selectedChannels: readonly ReminderChannel[];
  phoneValid: boolean;
  onChange: (channels: ReminderChannel[]) => void;
};

const CHANNEL_ICONS = {
  sms: MessageSquareText,
  whatsapp: MessageCircle,
} satisfies Record<ReminderChannel, typeof MessageSquareText>;

export default function ReminderChannelSelector({
  availableChannels,
  selectedChannels,
  phoneValid,
  onChange,
}: ReminderChannelSelectorProps) {
  const { t } = useI18n();

  if (availableChannels.length === 0) return null;

  const isSingleChannel = availableChannels.length === 1;
  const requiresPhone = selectedChannels.length > 0 && !phoneValid;

  return (
    <section
      aria-labelledby="guest-reminder-title"
      className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BellRing className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 id="guest-reminder-title" className="text-sm font-semibold text-foreground">
            {t('bookingWizard.reminders.title')}
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            {isSingleChannel
              ? t('bookingWizard.reminders.singleDescription')
              : t('bookingWizard.reminders.multipleDescription')}
          </p>
        </div>
      </div>

      <fieldset className={cn('grid gap-2', !isSingleChannel && 'sm:grid-cols-2')}>
        <legend className="sr-only">{t('bookingWizard.reminders.legend')}</legend>
        {availableChannels.map((channel) => {
          const checked = selectedChannels.includes(channel);
          const Icon = CHANNEL_ICONS[channel];
          const inputId = `guest-reminder-${channel}`;
          return (
            <div
              key={channel}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                checked
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border/70 bg-background/60 hover:border-primary/30',
              )}
            >
              <Checkbox
                id={inputId}
                checked={checked}
                onCheckedChange={(value) => onChange(toggleReminderChannel(
                  selectedChannels,
                  channel,
                  value === true,
                ))}
                className="mt-0.5"
              />
              <Label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer space-y-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {isSingleChannel
                    ? t('bookingWizard.reminders.singleOptIn', {
                        channel: t(`bookingWizard.reminders.channel.${channel}`),
                      })
                    : t(`bookingWizard.reminders.channel.${channel}`)}
                </span>
                <span className="block text-xs font-normal leading-5 text-muted-foreground">
                  {t(`bookingWizard.reminders.channel.${channel}Description`)}
                </span>
              </Label>
            </div>
          );
        })}
      </fieldset>

      {requiresPhone && (
        <p id="guest-reminder-phone-error" role="alert" className="text-xs font-medium text-destructive">
          {t('bookingWizard.reminders.phoneRequired')}
        </p>
      )}

      <p className="text-[11px] leading-4 text-muted-foreground">
        {t('bookingWizard.reminders.transactionalConsent')}
      </p>
    </section>
  );
}
