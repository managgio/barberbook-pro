import React, { useEffect, useMemo, useState } from 'react';
import { Languages, Loader2, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { getEntityTranslations, queueLocalizationRegeneration, upsertManualTranslation } from '@/data/api/localization';
import { LocalizableEntityType, LocalizedTranslationStatus } from '@/data/types';
import { getLanguageOption, resolveSupportedLanguages } from '@/lib/language';

type InlineTranslationPopoverProps = {
  entityType: LocalizableEntityType;
  entityId?: string | null;
  fieldKey: string;
  onUpdated?: () => Promise<void> | void;
};

const STATUS_VARIANT: Record<LocalizedTranslationStatus | 'missing', 'outline' | 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  ready: 'default',
  failed: 'destructive',
  stale: 'outline',
  missing: 'outline',
};

const InlineTranslationPopover: React.FC<InlineTranslationPopoverProps> = ({
  entityType,
  entityId,
  fieldKey,
  onUpdated,
}) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('');
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const i18nConfig = tenant?.config?.i18n;
  const { defaultLanguage, supportedLanguages } = useMemo(
    () => resolveSupportedLanguages(i18nConfig?.supportedLanguages || [], i18nConfig?.defaultLanguage),
    [i18nConfig?.defaultLanguage, i18nConfig?.supportedLanguages],
  );
  const autoTranslateEnabled = i18nConfig?.autoTranslate?.enabled !== false;
  const hasMultipleTenantLanguages = supportedLanguages.length > 1;

  const translationsQuery = useQuery({
    queryKey: ['inline-localization', entityType, entityId || 'new'],
    enabled: open && Boolean(entityId),
    queryFn: () => getEntityTranslations(entityType, entityId as string),
    refetchInterval: open && entityId ? 2000 : false,
    refetchOnWindowFocus: false,
  });

  const fieldData = useMemo(
    () => (translationsQuery.data || []).find((entry) => entry.fieldKey === fieldKey),
    [fieldKey, translationsQuery.data],
  );
  const sourceLanguage = fieldData?.sourceLanguage || defaultLanguage;
  const selectableLanguages = useMemo(() => {
    const fromTranslations = (fieldData?.translations || []).map((entry) => entry.language);
    return Array.from(new Set([sourceLanguage, ...supportedLanguages, ...fromTranslations]));
  }, [fieldData?.translations, sourceLanguage, supportedLanguages]);
  const targetLanguages = useMemo(
    () => selectableLanguages.filter((code) => code !== sourceLanguage),
    [selectableLanguages, sourceLanguage],
  );
  const isSourceLanguageSelected = language === sourceLanguage;
  const selectedTranslation = useMemo(
    () => fieldData?.translations.find((entry) => entry.language === language),
    [fieldData?.translations, language],
  );
  const status: LocalizedTranslationStatus | 'missing' = isSourceLanguageSelected
    ? 'ready'
    : selectedTranslation?.status || 'missing';

  useEffect(() => {
    if (!open) return;
    if (!language && selectableLanguages.length > 0) {
      setLanguage(targetLanguages[0] || selectableLanguages[0]);
    }
  }, [language, open, selectableLanguages, targetLanguages]);

  useEffect(() => {
    if (!open) return;
    if (isSourceLanguageSelected) {
      setDraft(fieldData?.sourceText || '');
      return;
    }
    setDraft(selectedTranslation?.translatedText || '');
  }, [fieldData?.sourceText, isSourceLanguageSelected, open, selectedTranslation?.translatedText, language]);

  const saveManual = async () => {
    if (!entityId || !language || isSourceLanguageSelected) return;
    const translatedText = draft.trim();
    if (!translatedText) {
      toast({
        title: t('admin.localization.toast.translationRequiredTitle'),
        description: t('admin.localization.toast.translationRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      await upsertManualTranslation({
        entityType,
        entityId,
        fieldKey,
        language,
        translatedText,
        manualLocked: true,
      });
      await translationsQuery.refetch();
      await onUpdated?.();
      toast({
        title: t('admin.localization.toast.manualSavedTitle'),
        description: t('admin.localization.toast.manualSavedDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.localization.toast.manualSaveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generate = async () => {
    if (!entityId || !language || isSourceLanguageSelected) return;
    if (!autoTranslateEnabled) {
      toast({
        title: t('admin.localization.toast.autoTranslateDisabledTitle'),
        description: t('admin.localization.toast.autoTranslateDisabledDescription'),
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      await queueLocalizationRegeneration({
        entityType,
        entityId,
        fieldKey,
        languages: [language],
      });
      await translationsQuery.refetch();
      toast({
        title: t('admin.localization.toast.regenerationQueuedTitle'),
        description: t('admin.localization.toast.regenerationQueuedDescription', { queued: 1, skipped: 0 }),
      });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.localization.toast.regenerationError'),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!entityId || !hasMultipleTenantLanguages) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label={t('admin.localization.actions.openManager')}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">
              {t('admin.localization.sourceLanguage', {
                language: getLanguageOption(sourceLanguage).code.toUpperCase(),
              })}
            </Badge>
            <Badge variant={STATUS_VARIANT[status]}>{t(`admin.localization.status.${status}`)}</Badge>
          </div>

          {selectableLanguages.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('admin.localization.inline.noTargetLanguages')}</p>
          ) : (
            <>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={t('admin.localization.inline.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  {selectableLanguages.map((code) => (
                    <SelectItem key={code} value={code}>
                      {getLanguageOption(code).nativeLabel}
                      {code === sourceLanguage ? ` ${t('admin.localization.inline.sourceSuffix')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                placeholder={t('admin.localization.translationPlaceholder')}
                disabled={isSourceLanguageSelected}
              />

              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => void generate()}
                  disabled={isGenerating || !autoTranslateEnabled || isSourceLanguageSelected}
                >
                  {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {t('admin.localization.inline.generate')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => void saveManual()}
                  disabled={isSaving || isSourceLanguageSelected}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  {t('admin.localization.inline.save')}
                </Button>
              </div>
              {isSourceLanguageSelected ? (
                <p className="text-[11px] text-muted-foreground">{t('admin.localization.inline.sourceReadonly')}</p>
              ) : null}
              {status === 'missing' ? (
                <p className="text-[11px] text-muted-foreground">{t('admin.localization.inline.missing')}</p>
              ) : null}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default InlineTranslationPopover;
