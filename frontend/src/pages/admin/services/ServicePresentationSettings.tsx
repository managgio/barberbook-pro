import { CheckCircle2, Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/hooks/useI18n';

type ServicePresentationSettingsProps = {
  categoriesEnabled: boolean;
  disabled: boolean;
  onToggleCategories: (enabled: boolean) => void;
  onToggleDescriptions: (enabled: boolean) => void;
  showDescriptions: boolean;
  uncategorizedCount: number;
};

const ServicePresentationSettings = ({
  categoriesEnabled,
  disabled,
  onToggleCategories,
  onToggleDescriptions,
  showDescriptions,
  uncategorizedCount,
}: ServicePresentationSettingsProps) => {
  const { t } = useI18n();

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {t('admin.services.presentation.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="font-medium text-sm text-foreground">
              {t('admin.services.presentation.groupByCategories')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('admin.services.presentation.groupByCategoriesDescription')}
            </p>
          </div>
          <Switch
            aria-label={t('admin.services.presentation.groupByCategories')}
            checked={categoriesEnabled}
            disabled={disabled}
            onCheckedChange={onToggleCategories}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="font-medium text-sm text-foreground">
              {t('admin.services.presentation.showDescriptions')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('admin.services.presentation.showDescriptionsDescription')}
            </p>
          </div>
          <Switch
            aria-label={t('admin.services.presentation.showDescriptions')}
            checked={showDescriptions}
            disabled={disabled}
            onCheckedChange={onToggleDescriptions}
          />
        </div>

        {categoriesEnabled && (
          <>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-primary font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {t('admin.services.presentation.categorizationActive')}
              </div>
              <p className="mt-2">
                {t('admin.services.presentation.categorizationActiveDescription')}
              </p>
            </div>
            {uncategorizedCount > 0 && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                {t('admin.services.presentation.uncategorizedWarning', { count: uncategorizedCount })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ServicePresentationSettings;
