import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import Navbar from '@/components/layout/Navbar';
import LegalFooter from '@/components/layout/LegalFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { LegalPolicyResponse } from '@/data/types';
import MarkdownContent from '@/components/common/MarkdownContent';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';

type LegalPageProps = {
  loadPolicy: () => Promise<LegalPolicyResponse>;
};

const LegalPage: React.FC<LegalPageProps> = ({ loadPolicy }) => {
  const { t, language } = useI18n();
  const [policy, setPolicy] = useState<LegalPolicyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchPolicy = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await loadPolicy();
        if (active) {
          setPolicy(data);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : t('legal.page.loadError');
          setError(message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchPolicy();
    return () => {
      active = false;
    };
  }, [loadPolicy, t]);

  const formattedDate =
    policy?.effectiveDate
      ? format(parseISO(policy.effectiveDate), 'PPP', { locale: resolveDateLocale(language) })
      : '';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-12">
        <div className="container px-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('legal.page.loading')}
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          {policy && !isLoading && !error && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{policy.title}</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('legal.page.versionAndEffective', { version: policy.version, date: formattedDate })}
                </p>
              </div>

              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>{t('legal.page.ownerIdentity')}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground">
                  <div>
                    <span className="text-foreground font-medium">{t('legal.page.fields.owner')}:</span>{' '}
                    {policy.businessIdentity.ownerName || t('legal.page.pending')}
                  </div>
                  <div>
                    <span className="text-foreground font-medium">{t('legal.page.fields.taxId')}:</span>{' '}
                    {policy.businessIdentity.taxId || t('legal.page.pending')}
                  </div>
                  <div>
                    <span className="text-foreground font-medium">{t('legal.page.fields.address')}:</span>{' '}
                    {policy.businessIdentity.address || t('legal.page.pending')}
                  </div>
                  <div>
                    <span className="text-foreground font-medium">{t('legal.page.fields.email')}:</span>{' '}
                    {policy.businessIdentity.contactEmail || t('legal.page.pending')}
                  </div>
                  {policy.businessIdentity.contactPhone && (
                    <div><span className="text-foreground font-medium">{t('legal.page.fields.phone')}:</span> {policy.businessIdentity.contactPhone}</div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                {policy.sections.map((section) => (
                  <div key={section.heading} className="space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
                    <MarkdownContent markdown={section.bodyMarkdown} />
                  </div>
                ))}
              </div>

              {policy.aiDisclosure && (
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>{policy.aiDisclosure.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <MarkdownContent markdown={policy.aiDisclosure.bodyMarkdown} />
                    {policy.aiDisclosure.providerNames.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {t('legal.page.providers', { providers: policy.aiDisclosure.providerNames.join(', ') })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {policy.subProcessors && policy.subProcessors.length > 0 && (
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>{t('legal.page.subprocessors.title')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 text-sm text-muted-foreground">
                      {policy.subProcessors.map((processor) => (
                        <div key={processor.name} className="rounded-lg border border-border/60 p-3">
                          <div className="text-foreground font-medium">{processor.name}</div>
                          <div className="mt-1">{processor.purpose}</div>
                          <div className="mt-1">{t('legal.page.subprocessors.country', { country: processor.country })}</div>
                          <div className="mt-1">{t('legal.page.subprocessors.data', { data: processor.dataTypes })}</div>
                          {processor.link && (
                            <a
                              href={processor.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-primary underline underline-offset-4"
                            >
                              {t('legal.page.subprocessors.viewMore')}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
};

export default LegalPage;
