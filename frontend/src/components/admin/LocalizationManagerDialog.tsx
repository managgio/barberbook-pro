import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getEntityTranslations,
  queueLocalizationRegeneration,
  upsertManualTranslation,
} from '@/data/api/localization';
import { LocalizableEntityType, LocalizedEntityField, LocalizedTranslationStatus } from '@/data/types';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import { useTenant } from '@/context/TenantContext';
import { getLanguageOption, resolveSupportedLanguages } from '@/lib/language';
import { queryKeys } from '@/lib/queryKeys';

type TranslationTarget = {
  entityType: LocalizableEntityType;
  entityId: string;
  entityLabel?: string;
};

type LocalizationManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: TranslationTarget | null;
  fieldLabels?: Record<string, string>;
  onEntityUpdated?: () => Promise<void> | void;
};

const keyForDraft = (fieldKey: string, language: string) => `${fieldKey}::${language}`;

const STATUS_VARIANT: Record<LocalizedTranslationStatus | 'missing', 'outline' | 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  ready: 'default',
  failed: 'destructive',
  stale: 'outline',
  missing: 'outline',
};

const LocalizationManagerDialog: React.FC<LocalizationManagerDialogProps> = ({
  open,
  onOpenChange,
  target,
  fieldLabels,
  onEntityUpdated,
}) => {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { tenant, currentLocationId } = useTenant();
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, string>>({});
  const [manualLocks, setManualLocks] = useState<Record<string, boolean>>({});
  const [isSavingKey, setIsSavingKey] = useState<string | null>(null);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState<string | null>(null);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [forceManualRegeneration, setForceManualRegeneration] = useState(false);

  const i18nConfig = tenant?.config?.i18n;
  const { defaultLanguage, supportedLanguages } = useMemo(
    () => resolveSupportedLanguages(i18nConfig?.supportedLanguages || [], i18nConfig?.defaultLanguage),
    [i18nConfig?.defaultLanguage, i18nConfig?.supportedLanguages],
  );
  const autoTranslateEnabled = i18nConfig?.autoTranslate?.enabled !== false;

  const translationsQuery = useQuery({
    queryKey:
      target?.entityType && target?.entityId
        ? queryKeys.localizationEntity(currentLocationId, target.entityType, target.entityId)
        : ['localization', 'empty'],
    queryFn: () => getEntityTranslations(target!.entityType, target!.entityId),
    enabled: open && Boolean(target?.entityType) && Boolean(target?.entityId),
  });

  useEffect(() => {
    if (!translationsQuery.data) return;
    const nextDrafts: Record<string, string> = {};
    const nextManualLocks: Record<string, boolean> = {};
    for (const field of translationsQuery.data) {
      for (const translation of field.translations) {
        const draftKey = keyForDraft(field.fieldKey, translation.language);
        nextDrafts[draftKey] = translation.translatedText || '';
        nextManualLocks[draftKey] = translation.manualLocked;
      }
    }
    setTranslationDrafts(nextDrafts);
    setManualLocks(nextManualLocks);
  }, [translationsQuery.data, target?.entityId, target?.entityType]);

  const resolveFieldLabel = (fieldKey: string) =>
    fieldLabels?.[fieldKey] || t('admin.localization.field.generic', { fieldKey });

  const resolveLanguageList = (field: LocalizedEntityField) => {
    const configuredTargets = supportedLanguages.filter((langCode) => langCode !== field.sourceLanguage);
    const translationTargets = field.translations
      .map((item) => item.language)
      .filter((langCode) => langCode !== field.sourceLanguage);
    return [...configuredTargets, ...translationTargets.filter((langCode) => !configuredTargets.includes(langCode))];
  };

  const statusLabel = (status: LocalizedTranslationStatus | 'missing') =>
    t(`admin.localization.status.${status}`);

  const sourceLabel = (source?: 'ai' | 'manual') =>
    source ? t(`admin.localization.source.${source}`) : t('admin.localization.source.missing');

  const formatDateTime = (value?: string | null) => {
    if (!value) return t('admin.localization.value.notAvailable');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('admin.localization.value.notAvailable');
    return date.toLocaleString(language.startsWith('en') ? 'en-US' : 'es-ES');
  };

  const saveManualTranslation = async (field: LocalizedEntityField, targetLanguage: string) => {
    if (!target) return;
    const draftKey = keyForDraft(field.fieldKey, targetLanguage);
    const translatedText = (translationDrafts[draftKey] || '').trim();
    const manualLocked = manualLocks[draftKey] ?? true;

    if (!translatedText) {
      toast({
        title: t('admin.localization.toast.translationRequiredTitle'),
        description: t('admin.localization.toast.translationRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsSavingKey(draftKey);
    try {
      await upsertManualTranslation({
        entityType: target.entityType,
        entityId: target.entityId,
        fieldKey: field.fieldKey,
        language: targetLanguage,
        translatedText,
        manualLocked,
      });
      toast({
        title: t('admin.localization.toast.manualSavedTitle'),
        description: t('admin.localization.toast.manualSavedDescription'),
      });
      await translationsQuery.refetch();
      await onEntityUpdated?.();
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description:
          error instanceof Error ? error.message : t('admin.localization.toast.manualSaveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingKey(null);
    }
  };

  const regenerateTranslation = async (params: {
    fieldKey?: string;
    languages?: string[];
  }) => {
    if (!target) return;
    if (!autoTranslateEnabled) {
      toast({
        title: t('admin.localization.toast.autoTranslateDisabledTitle'),
        description: t('admin.localization.toast.autoTranslateDisabledDescription'),
        variant: 'destructive',
      });
      return;
    }

    const actionKey = `${params.fieldKey || 'all'}::${(params.languages || []).join(',') || 'all'}`;
    setIsRegeneratingKey(actionKey);
    try {
      const result = await queueLocalizationRegeneration({
        entityType: target.entityType,
        entityId: target.entityId,
        fieldKey: params.fieldKey,
        languages: params.languages,
        forceManual: forceManualRegeneration,
      });
      toast({
        title: t('admin.localization.toast.regenerationQueuedTitle'),
        description: t('admin.localization.toast.regenerationQueuedDescription', {
          queued: result.queued,
          skipped: result.skippedManual,
        }),
      });
      await translationsQuery.refetch();
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description:
          error instanceof Error ? error.message : t('admin.localization.toast.regenerationError'),
        variant: 'destructive',
      });
    } finally {
      setIsRegeneratingKey(null);
    }
  };

  const handleRegenerateAll = async () => {
    setIsRegeneratingAll(true);
    try {
      await regenerateTranslation({});
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t('admin.localization.title')}
            {target?.entityLabel && (
              <span className="text-sm font-medium text-muted-foreground">- {target.entityLabel}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            {t('admin.localization.subtitle', {
              defaultLanguage: getLanguageOption(defaultLanguage).code.toUpperCase(),
              supportedLanguages: supportedLanguages.map((entry) => entry.toUpperCase()).join(', '),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={autoTranslateEnabled ? 'default' : 'outline'}>
              {autoTranslateEnabled
                ? t('admin.localization.autoTranslateEnabled')
                : t('admin.localization.autoTranslateDisabled')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {autoTranslateEnabled
                ? t('admin.localization.autoTranslateEnabledDescription')
                : t('admin.localization.autoTranslateDisabledDescription')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void translationsQuery.refetch()}
              disabled={translationsQuery.isFetching}
            >
              {translationsQuery.isFetching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4 mr-2" />
              )}
              {t('admin.localization.actions.refresh')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleRegenerateAll()}
              disabled={isRegeneratingAll || !autoTranslateEnabled}
            >
              {isRegeneratingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {t('admin.localization.actions.regenerateAll')}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <div>
            <Label htmlFor="force-manual-regeneration">{t('admin.localization.forceManual.title')}</Label>
            <p className="text-xs text-muted-foreground">{t('admin.localization.forceManual.description')}</p>
          </div>
          <Switch
            id="force-manual-regeneration"
            checked={forceManualRegeneration}
            onCheckedChange={setForceManualRegeneration}
          />
        </div>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            {translationsQuery.isLoading ? (
              <div className="py-8 text-sm text-muted-foreground">{t('admin.localization.loading')}</div>
            ) : null}

            {!translationsQuery.isLoading && (translationsQuery.data?.length || 0) === 0 ? (
              <div className="py-8 text-sm text-muted-foreground">{t('admin.localization.empty')}</div>
            ) : null}

            {(translationsQuery.data || []).map((field) => {
              const targetLanguages = resolveLanguageList(field);
              return (
                <Card key={field.fieldKey} variant="elevated">
                  <CardHeader>
                    <CardTitle className="text-base">{resolveFieldLabel(field.fieldKey)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {t('admin.localization.sourceLanguage', {
                            language: getLanguageOption(field.sourceLanguage).code.toUpperCase(),
                          })}
                        </Badge>
                        <Badge variant="outline">
                          {t('admin.localization.sourceVersion', { version: field.sourceVersion })}
                        </Badge>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{field.sourceText}</p>
                    </div>

                    {targetLanguages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('admin.localization.noTargetLanguages')}</p>
                    ) : (
                      <div className="space-y-3">
                        {targetLanguages.map((targetLanguage) => {
                          const translation = field.translations.find((item) => item.language === targetLanguage);
                          const draftKey = keyForDraft(field.fieldKey, targetLanguage);
                          const status = translation?.status || 'missing';
                          const lockValue = manualLocks[draftKey] ?? translation?.manualLocked ?? true;
                          const isSaving = isSavingKey === draftKey;
                          const isRegenerating =
                            isRegeneratingKey === `${field.fieldKey}::${targetLanguage}`;

                          return (
                            <div key={targetLanguage} className="rounded-lg border border-border p-3 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    {t('admin.localization.language', {
                                      language: getLanguageOption(targetLanguage).nativeLabel,
                                    })}
                                  </Badge>
                                  <Badge variant={STATUS_VARIANT[status]}>
                                    {statusLabel(status)}
                                  </Badge>
                                  <Badge variant="secondary">{sourceLabel(translation?.source)}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t('admin.localization.updatedAt', {
                                    value: formatDateTime(translation?.updatedAt),
                                  })}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                                <div>
                                  <Label htmlFor={`lock-${draftKey}`}>{t('admin.localization.manualLock')}</Label>
                                  <p className="text-xs text-muted-foreground">
                                    {t('admin.localization.manualLockDescription')}
                                  </p>
                                </div>
                                <Switch
                                  id={`lock-${draftKey}`}
                                  checked={lockValue}
                                  onCheckedChange={(checked) =>
                                    setManualLocks((prev) => ({ ...prev, [draftKey]: checked }))
                                  }
                                />
                              </div>

                              <Textarea
                                value={translationDrafts[draftKey] ?? translation?.translatedText ?? ''}
                                onChange={(event) =>
                                  setTranslationDrafts((prev) => ({
                                    ...prev,
                                    [draftKey]: event.target.value,
                                  }))
                                }
                                placeholder={t('admin.localization.translationPlaceholder')}
                              />

                              {translation?.errorMessage ? (
                                <p className="text-xs text-destructive">
                                  {t('admin.localization.errorMessage', { message: translation.errorMessage })}
                                </p>
                              ) : null}

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void saveManualTranslation(field, targetLanguage)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : null}
                                  {t('admin.localization.actions.saveManual')}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    void regenerateTranslation({
                                      fieldKey: field.fieldKey,
                                      languages: [targetLanguage],
                                    })
                                  }
                                  disabled={isRegenerating || !autoTranslateEnabled}
                                >
                                  {isRegenerating ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-4 h-4 mr-2" />
                                  )}
                                  {t('admin.localization.actions.regenerateOne')}
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
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin.localization.actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LocalizationManagerDialog;
