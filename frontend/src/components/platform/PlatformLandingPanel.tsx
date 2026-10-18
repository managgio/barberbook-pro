import type { ReactNode } from 'react';
import { Image, LayoutTemplate, Settings2, Text } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useI18n } from '@/hooks/useI18n';

export default function PlatformLandingPanel({ sections, hero, images, presentation }: {
  sections: ReactNode; hero: ReactNode; images: ReactNode; presentation: ReactNode;
}) {
  const { t } = useI18n();
  const groups = [
    { key: 'sections', title: t('platform.landing.sections'), icon: LayoutTemplate, content: sections },
    { key: 'hero', title: t('platform.landing.header'), icon: Settings2, content: hero },
    { key: 'images', title: t('website.images'), icon: Image, content: images },
    { key: 'presentation', title: t('website.platformMediaPresentation'), icon: Text, content: presentation },
  ];
  return <Accordion type="single" collapsible defaultValue="sections">
    {groups.map(({ key, title, icon: Icon, content }) => <AccordionItem key={key} value={key} className="last:border-b-0">
      <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
        <span className="flex items-center gap-2.5"><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />{title}</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-5">{content}</AccordionContent>
    </AccordionItem>)}
  </Accordion>;
}
