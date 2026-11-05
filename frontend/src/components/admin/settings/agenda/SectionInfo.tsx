import { useId } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useI18n } from '@/hooks/useI18n';

export default function SectionInfo({ title, description, example }: {
  title: string;
  description: string;
  example: string;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground"
          aria-label={t('admin.settings.agenda.sectionInfo', { section: title })}>
          <Info aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" role="dialog" aria-labelledby={id + '-title'} aria-describedby={id + '-description'}
        className="space-y-3 text-sm">
        <h4 id={id + '-title'} className="font-semibold">{title}</h4>
        <p id={id + '-description'}>{description}</p>
        <p className="text-muted-foreground">{example}</p>
      </PopoverContent>
    </Popover>
  );
}
