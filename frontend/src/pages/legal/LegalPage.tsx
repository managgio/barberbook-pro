import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Navbar from '@/components/layout/Navbar';
import LegalFooter from '@/components/layout/LegalFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { LegalPolicyResponse } from '@/data/types';
import MarkdownContent from '@/components/common/MarkdownContent';

type LegalPageProps = {
  loadPolicy: () => Promise<LegalPolicyResponse>;
};

const LegalPage: React.FC<LegalPageProps> = ({ loadPolicy }) => {
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
          const message = err instanceof Error ? err.message : 'No se pudo cargar el contenido legal.';
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
  }, [loadPolicy]);

  const formattedDate =
    policy?.effectiveDate ? format(parseISO(policy.effectiveDate), "d 'de' MMMM, yyyy", { locale: es }) : '';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-12">
        <div className="container px-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando contenido legal...
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
                  Version {policy.version} - Vigente desde {formattedDate}
                </p>
              </div>

              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Identidad del titular</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground">
                  <div><span className="text-foreground font-medium">Responsable:</span> {policy.businessIdentity.ownerName || 'Pendiente de configurar'}</div>
                  <div><span className="text-foreground font-medium">NIF/CIF:</span> {policy.businessIdentity.taxId || 'Pendiente de configurar'}</div>
                  <div><span className="text-foreground font-medium">Direccion:</span> {policy.businessIdentity.address || 'Pendiente de configurar'}</div>
                  <div><span className="text-foreground font-medium">Email:</span> {policy.businessIdentity.contactEmail || 'Pendiente de configurar'}</div>
                  {policy.businessIdentity.contactPhone && (
                    <div><span className="text-foreground font-medium">Telefono:</span> {policy.businessIdentity.contactPhone}</div>
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
                        Proveedores: {policy.aiDisclosure.providerNames.join(', ')}.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {policy.subProcessors && policy.subProcessors.length > 0 && (
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>Subprocesadores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 text-sm text-muted-foreground">
                      {policy.subProcessors.map((processor) => (
                        <div key={processor.name} className="rounded-lg border border-border/60 p-3">
                          <div className="text-foreground font-medium">{processor.name}</div>
                          <div className="mt-1">{processor.purpose}</div>
                          <div className="mt-1">Pais: {processor.country}</div>
                          <div className="mt-1">Datos: {processor.dataTypes}</div>
                          {processor.link && (
                            <a
                              href={processor.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-primary underline underline-offset-4"
                            >
                              Ver mas
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
