import { useId } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { useI18n } from '@/hooks/useI18n';
import SectionInfo from './SectionInfo';

export default function AgendaSectionHeading({ title, summary, description, example, icon: Icon, disabled }: {
  title: string;
  summary: string;
  description: string;
  example: string;
  icon: LucideIcon;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 id={id + '-title'} className="min-w-0 text-sm font-semibold">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" disabled={disabled} aria-describedby={id + '-summary'}
                className="h-auto justify-start whitespace-normal px-0 text-left font-semibold">{title}</Button>
            </CollapsibleTrigger>
          </h3>
          <SectionInfo title={title} description={description} example={example} />
        </div>
        <p id={id + '-summary'} className="text-sm text-muted-foreground">{summary}</p>
      </div>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled}
          aria-label={t('admin.settings.agenda.toggleDetails')} aria-describedby={id + '-title'}>
          <ChevronDown aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
    </div>
  );
}
