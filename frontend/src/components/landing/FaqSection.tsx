import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import { getFaqs } from '@/data/api/faqs';
import { queryKeys } from '@/lib/queryKeys';
import LandingSectionAccent from './LandingSectionAccent';

export default function FaqSection() {
  const { tenant, currentLocationId } = useTenant();
  const { t, language } = useI18n();
  const enabled = tenant?.config?.features?.faqEnabled === true;
  const { data } = useQuery({
    queryKey: queryKeys.faqs(currentLocationId, language),
    queryFn: ({ signal }) => getFaqs(false, signal),
    enabled: enabled && Boolean(currentLocationId),
  });
  if (!enabled || !data?.length) return null;
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-border/50 py-12 sm:py-20">
      <div className="container max-w-4xl px-4">
        <div className="mb-8 space-y-3 text-center sm:mb-12">
          <LandingSectionAccent centered />
          <h2 id="faq-title" className="text-2xl font-bold tracking-tight sm:text-4xl">{t('landing.faq.title')}</h2>
          <p className="text-sm text-muted-foreground sm:text-base">{t('landing.faq.description')}</p>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {data.map((faq) => <AccordionItem key={faq.id} value={faq.id} className="rounded-xl border border-primary/15 bg-card px-4 transition-colors data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 sm:px-6">
            <AccordionTrigger className="gap-4 text-left text-sm font-medium hover:no-underline sm:text-base"><span className="min-w-0 break-words">{faq.question}</span></AccordionTrigger>
            <AccordionContent className="whitespace-pre-line break-words pb-5 leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>)}
        </Accordion>
      </div>
    </section>
  );
}
