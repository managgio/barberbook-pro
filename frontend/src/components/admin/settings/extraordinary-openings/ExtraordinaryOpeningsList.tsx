import React from 'react';
import { CalendarDays, Loader2, Pencil, Trash2 } from 'lucide-react';

import type { ExtraordinaryOpening } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ExtraordinaryOpeningsListProps = {
  openings: Array<[string, ExtraordinaryOpening]>;
  isLoading: boolean;
  isSaving: boolean;
  language: string;
  resolveProfessionalNames: (ids: string[]) => string[];
  onEdit: (date: string, opening: ExtraordinaryOpening) => void;
  onDelete: (date: string) => void;
};

const ExtraordinaryOpeningsList: React.FC<ExtraordinaryOpeningsListProps> = ({
  openings,
  isLoading,
  isSaving,
  language,
  resolveProfessionalNames,
  onEdit,
  onDelete,
}) => {
  const { t } = useI18n();
  const formatDate = (dateOnly: string) => new Intl.DateTimeFormat(
    language.startsWith('en') ? 'en-GB' : 'es-ES',
    { dateStyle: 'full' },
  ).format(new Date(`${dateOnly}T12:00:00`));

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>{t('admin.settings.extraordinary.upcomingTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('admin.settings.extraordinary.upcomingDescription')}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('admin.settings.extraordinary.loading')}
          </div>
        ) : openings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">{t('admin.settings.extraordinary.emptyTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.settings.extraordinary.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openings.map(([date, opening]) => {
              const names = resolveProfessionalNames(opening.barberIds);
              const shifts = [
                opening.morning.enabled
                  ? `${opening.morning.start}-${opening.morning.end}`
                  : null,
                opening.afternoon.enabled
                  ? `${opening.afternoon.start}-${opening.afternoon.end}`
                  : null,
              ].filter(Boolean).join(' · ');
              return (
                <div
                  key={date}
                  className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-foreground">
                      {opening.name || t('admin.settings.extraordinary.defaultName')}
                    </p>
                    <p className="capitalize text-sm text-foreground">{formatDate(date)}</p>
                    <p className="text-sm text-muted-foreground">{shifts}</p>
                    <p className="text-xs text-muted-foreground">
                      {opening.allProfessionals
                        ? t('admin.settings.extraordinary.allProfessionals')
                        : t('admin.settings.extraordinary.professionalList', {
                          names: names.join(', ') || t('admin.settings.extraordinary.unavailableProfessionals'),
                        })}
                    </p>
                  </div>
                  <div className="flex gap-2 lg:shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(date, opening)}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      {t('admin.settings.extraordinary.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(date)}
                      disabled={isSaving}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('admin.settings.extraordinary.delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExtraordinaryOpeningsList;
