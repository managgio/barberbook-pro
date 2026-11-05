import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { AdminStripeConfig, InvoiceLegalSettings, ShopSchedule, SiteSettings } from '@/data/types';
import { getShopSchedule, updateShopSchedule } from '@/data/api/schedules';
import { updateSiteSettings } from '@/data/api/settings';
import { getAdminInvoiceLegalSettings, updateAdminInvoiceLegalSettings } from '@/data/api/legal';
import { createAdminStripeConnect, getAdminStripeConfig, updateAdminStripeConfig } from '@/data/api/payments';
import { useToast } from '@/hooks/use-toast';
import { buildSettingsSectionPayload, settingsWithDraftPhone, SETTINGS_PHONE_PREFIX as PHONE_PREFIX } from '@/lib/settingsSections';
import { useTenant } from '@/context/TenantContext';
import { dispatchSchedulesUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { useBusinessCopy } from '@/lib/businessCopy';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { isApiRequestError } from '@/lib/networkErrors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';
import ExtraordinaryOpeningsSettings from '@/components/admin/settings/ExtraordinaryOpeningsSettings';
import AgendaSettings from '@/components/admin/settings/AgendaSettings';
import { useGeneralSettingsDraft } from '@/components/admin/settings/useGeneralSettingsDraft';
import {
  Loader2,
  MapPin,
  Globe2,
  Link2,
  Sparkles,
  Calendar,
  Star,
  Repeat,
  Settings,
  Clock,
  Instagram,
  Music2,
  Youtube,
  Linkedin,
  Boxes,
  CreditCard,
  UserCircle,
  FileText,
} from 'lucide-react';


type SettingsTab = 'identity' | 'operations' | 'availability' | 'extraordinary-openings';

const SETTINGS_TAB_STORAGE_KEY = 'admin-settings-active-tab';
const SETTINGS_TABS: SettingsTab[] = ['identity', 'operations', 'availability', 'extraordinary-openings'];

const AdminSettings: React.FC = () => {
  const XBrandIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 3h4.7l4.2 5.4L16.3 3H21l-7.3 8.9L21 21h-4.7l-4.5-5.8L7.7 21H3l7.3-8.8L3 3Z" />
    </svg>
  );

  const { toast } = useToast();
  const { tenant, currentLocationId } = useTenant();
  const currentLocationRef = useRef({ localId: currentLocationId });
  if (currentLocationRef.current.localId !== currentLocationId) {
    currentLocationRef.current = { localId: currentLocationId };
  }
  const copy = useBusinessCopy();
  const { t, language } = useI18n();
  const productsModuleEnabled = !tenant?.config?.adminSidebar?.hiddenSections?.includes('stock');
  const invoicingEnabled = tenant?.config?.invoicing?.enabled === true;
  const multiServiceCapabilityEnabled = tenant?.config?.features?.multiServiceBookingEnabled === true;
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [shopSchedule, setShopSchedule] = useState<ShopSchedule | null>(null);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [agendaActionsContainer, setAgendaActionsContainer] = useState<HTMLDivElement | null>(null);
  const [isStripeSaving, setIsStripeSaving] = useState(false);
  const [isStripeConnecting, setIsStripeConnecting] = useState(false);
  const [isSavingInvoiceLegal, setIsSavingInvoiceLegal] = useState(false);
  const [invoiceLegal, setInvoiceLegal] = useState<InvoiceLegalSettings>({
    legalOwnerName: '',
    legalOwnerTaxId: '',
    legalOwnerAddress: '',
    legalContactEmail: '',
    legalContactPhone: '',
    country: 'ES',
  });
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined') return 'identity';
    const saved = window.sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
    return SETTINGS_TABS.includes(saved as SettingsTab) ? (saved as SettingsTab) : 'identity';
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettings(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: () => fetchSiteSettingsCached(currentLocationId),
  });
  const scheduleQuery = useQuery({
    queryKey: queryKeys.shopSchedule(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: getShopSchedule,
  });
  const stripeConfigQuery = useQuery<AdminStripeConfig>({
    queryKey: queryKeys.adminStripeConfig(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: getAdminStripeConfig,
  });
  const invoiceLegalQuery = useQuery<InvoiceLegalSettings>({
    queryKey: queryKeys.adminInvoiceLegalSettings(tenant?.brand?.id),
    enabled: Boolean(currentLocationId && invoicingEnabled),
    queryFn: getAdminInvoiceLegalSettings,
  });
  const { settings, baseline, phoneNumber, setSettings, setPhoneNumber, acceptSaved } =
    useGeneralSettingsDraft(currentLocationRef.current, settingsQuery.data);
  const isLoading = settingsQuery.isLoading;
  const isScheduleLoading = scheduleQuery.isLoading;
  const isStripeLoading = stripeConfigQuery.isLoading;
  const stripeConfig = stripeConfigQuery.data ?? null;

  useEffect(() => {
    if (!scheduleQuery.data) return;
    setShopSchedule(scheduleQuery.data);
  }, [scheduleQuery.data]);

  useEffect(() => {
    setIsSaving(false);
    setIsSavingAvailability(false);
    setIsSavingSchedule(false);
  }, [currentLocationId]);

  useEffect(() => {
    if (!invoiceLegalQuery.data) return;
    setInvoiceLegal(invoiceLegalQuery.data);
  }, [invoiceLegalQuery.data]);

  useEffect(() => {
    if (!settingsQuery.error) return;
    toast({
      title: t('admin.settings.toast.loadSettingsErrorTitle'),
      description: t('admin.common.tryAgainInSeconds'),
      variant: 'destructive',
    });
  }, [settingsQuery.error, t, toast]);

  useEffect(() => {
    if (!scheduleQuery.error) return;
    toast({
      title: t('admin.settings.toast.loadAvailabilityErrorTitle'),
      description: t('admin.common.tryAgainInSeconds'),
      variant: 'destructive',
    });
  }, [scheduleQuery.error, t, toast]);

  useEffect(() => {
    if (!stripeConfigQuery.error) return;
    toast({
      title: t('admin.settings.toast.loadStripeErrorTitle'),
      description: t('admin.settings.toast.loadStripeErrorDescription'),
      variant: 'destructive',
    });
  }, [stripeConfigQuery.error, t, toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const handleSave = async () => {
    if ((activeTab !== 'identity' && activeTab !== 'operations') || isSaving || !settingsQuery.data) return;
    const savingScope = currentLocationRef.current;
    const savingLocalId = currentLocationId;
    const payload = buildSettingsSectionPayload(baseline, settingsWithDraftPhone(settings, phoneNumber), activeTab);
    setIsSaving(true);
    try {
      const previousSlotInterval = baseline.appointments?.slotIntervalMinutes ?? 15;
      const updated = await updateSiteSettings(payload);
      if (currentLocationRef.current !== savingScope) return;
      acceptSaved(updated, payload);
      dispatchSiteSettingsUpdated(updated);
      const nextSlotInterval = updated.appointments?.slotIntervalMinutes ?? 15;
      if (previousSlotInterval !== nextSlotInterval) {
        dispatchSchedulesUpdated({ source: 'admin-settings', localId: savingLocalId });
      }
      toast({
        title: t('admin.settings.toast.updatedTitle'),
        description: t('admin.settings.toast.updatedDescription'),
      });
    } catch (error) {
      if (currentLocationRef.current !== savingScope) return;
      const message = error instanceof Error ? error.message : t('admin.settings.toast.genericSaveError');
      toast({
        title: t('admin.settings.toast.saveErrorTitle'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      if (currentLocationRef.current === savingScope) setIsSaving(false);
    }
  };

  const handleStripeToggle = async (enabled: boolean) => {
    if (!stripeConfig || isStripeSaving) return;
    setIsStripeSaving(true);
    try {
      await updateAdminStripeConfig(enabled);
      await stripeConfigQuery.refetch();
      toast({
        title: t('admin.settings.toast.paymentPreferencesUpdatedTitle'),
        description: enabled
          ? t('admin.settings.toast.stripeEnabledForLocation', { location: copy.location.definiteSingular })
          : t('admin.settings.toast.stripeDisabledForLocation', { location: copy.location.definiteSingular }),
      });
    } catch (error) {
      toast({
        title: t('admin.settings.toast.updateStripeErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setIsStripeSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    if (isStripeConnecting) return;
    setIsStripeConnecting(true);
    try {
      const data = await createAdminStripeConnect();
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener');
      }
      await stripeConfigQuery.refetch();
    } catch (error) {
      toast({
        title: t('admin.settings.toast.startStripeErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setIsStripeConnecting(false);
    }
  };

  const handleSaveInvoiceLegal = async () => {
    if (isSavingInvoiceLegal) return;
    if (
      !invoiceLegal.legalOwnerName.trim()
      || !invoiceLegal.legalOwnerTaxId?.trim()
      || !invoiceLegal.legalOwnerAddress?.trim()
    ) {
      toast({
        title: t('admin.settings.invoicing.validationTitle'),
        description: t('admin.settings.invoicing.validationDescription'),
        variant: 'destructive',
      });
      return;
    }
    setIsSavingInvoiceLegal(true);
    try {
      const updated = await updateAdminInvoiceLegalSettings({
        legalOwnerName: invoiceLegal.legalOwnerName.trim(),
        legalOwnerTaxId: invoiceLegal.legalOwnerTaxId.trim(),
        legalOwnerAddress: invoiceLegal.legalOwnerAddress.trim(),
        legalContactEmail: invoiceLegal.legalContactEmail?.trim() || null,
        legalContactPhone: invoiceLegal.legalContactPhone?.trim() || null,
        country: invoiceLegal.country.trim().toUpperCase() || 'ES',
      });
      setInvoiceLegal(updated);
      await invoiceLegalQuery.refetch();
      toast({
        title: t('admin.settings.invoicing.savedTitle'),
        description: t('admin.settings.invoicing.savedDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.settings.toast.saveErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.settings.toast.genericSaveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingInvoiceLegal(false);
    }
  };

  const handleBrandingChange = (field: keyof SiteSettings['branding'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      branding: { ...prev.branding, [field]: value },
    }));
  };

  const handleLocationChange = (field: keyof SiteSettings['location'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      location: { ...prev.location, [field]: value },
    }));
  };

  const handleSocialChange = (field: keyof SiteSettings['socials'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      socials: { ...prev.socials, [field]: value },
    }));
  };

  const handleStatsChange = (field: Exclude<keyof SiteSettings['stats'], 'visibility'>, value: number) => {
    setSettings((prev) => ({
      ...prev,
      stats: { ...prev.stats, [field]: value },
    }));
  };

  const handleStatsVisibilityChange = (field: keyof SiteSettings['stats']['visibility'], enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        visibility: {
          ...prev.stats.visibility,
          [field]: enabled,
        },
      },
    }));
  };

  const handleSaveAvailabilityAndSchedule = async (schedulePayload: ShopSchedule): Promise<ShopSchedule> => {
    if (isSavingAvailability || isSavingSchedule) throw new Error(t('admin.settings.agenda.saving'));
    const savingLocalId = currentLocationId;
    const savingScope = currentLocationRef.current;
    setIsSavingAvailability(true);
    setIsSavingSchedule(true);
    try {
      const updatedSchedule = await updateShopSchedule(schedulePayload);
      if (currentLocationRef.current !== savingScope) return updatedSchedule;
      const updatedSettings = { ...baseline, openingHours: updatedSchedule };
      setShopSchedule(updatedSchedule);
      acceptSaved(updatedSettings, baseline);
      await scheduleQuery.refetch();
      if (currentLocationRef.current !== savingScope) return updatedSchedule;
      dispatchSchedulesUpdated({ source: 'admin-settings', localId: savingLocalId });
      dispatchSiteSettingsUpdated(updatedSettings);
      toast({
        title: t('admin.settings.toast.scheduleUpdatedTitle'),
        description: t('admin.settings.toast.scheduleUpdatedDescription'),
      });
      return updatedSchedule;
    } catch (error) {
      if (currentLocationRef.current !== savingScope) throw error;
      const message = error instanceof Error ? error.message : t('admin.settings.toast.genericSaveError');
      toast({
        title: t('admin.settings.toast.saveErrorTitle'),
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      if (currentLocationRef.current === savingScope) {
        setIsSavingAvailability(false);
        setIsSavingSchedule(false);
      }
    }
  };

  const handleExtraordinaryOpeningsUpdated = (
    extraordinaryOpenings: NonNullable<ShopSchedule['extraordinaryOpenings']>,
  ) => {
    setShopSchedule((current) => current ? { ...current, extraordinaryOpenings } : current);
    setSettings((current) => ({
      ...current,
      openingHours: { ...current.openingHours, extraordinaryOpenings },
    }));
    void scheduleQuery.refetch();
  };

  const experienceYears = Math.max(0, new Date().getFullYear() - settings.stats.experienceStartYear);
  const statsVisibility = settings.stats.visibility || {
    experienceYears: true,
    averageRating: true,
    yearlyBookings: true,
    repeatClientsPercentage: true,
  };
  const statsPreviewItems = [
    { key: 'experienceYears', icon: Sparkles, label: t('admin.settings.stats.experienceYears'), value: `${experienceYears}+` },
    { key: 'averageRating', icon: Star, label: t('admin.settings.stats.averageRating'), value: settings.stats.averageRating.toFixed(1) },
    {
      key: 'yearlyBookings',
      icon: Calendar,
      label: t('admin.settings.stats.yearlyBookings'),
      value: settings.stats.yearlyBookings.toLocaleString(language.startsWith('en') ? 'en-US' : 'es-ES'),
    },
    {
      key: 'repeatClientsPercentage',
      icon: Repeat,
      label: t('admin.settings.stats.repeatClientsPercentage'),
      value: `${settings.stats.repeatClientsPercentage}%`,
    },
  ];
  const stripeReady = Boolean(stripeConfig?.status?.chargesEnabled && stripeConfig?.status?.detailsSubmitted);
  const stripeStatusLabel = !stripeConfig?.brandEnabled
    ? t('admin.settings.stripe.status.disabledByBrand')
    : !stripeConfig?.platformEnabled
      ? t('admin.settings.stripe.status.disabledByPlatform')
      : stripeConfig?.accountIdExists
        ? stripeReady
          ? t('admin.settings.stripe.status.connected')
          : t('admin.settings.stripe.status.pending')
        : t('admin.settings.stripe.status.notConnected');
  const stripeModeLabel = stripeConfig?.mode === 'brand'
    ? t('admin.settings.stripe.mode.brand')
    : t('admin.settings.stripe.mode.location', { locationSingularLower: copy.location.singularLower });
  const stripeVisible = Boolean(stripeConfig?.brandEnabled && stripeConfig?.platformEnabled);
  const isCurrentTabSaving = activeTab === 'availability'
    ? (isSavingAvailability || isSavingSchedule)
    : isSaving;
  const isCurrentTabSaveDisabled = activeTab === 'availability'
    ? (isLoading || isScheduleLoading || !shopSchedule || isSavingAvailability || isSavingSchedule || isSaving)
    : (isLoading || isSaving || isSavingSchedule || isSavingAvailability);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">
            {activeTab === 'availability' ? t('admin.settings.tabs.availability') : t('admin.settings.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeTab === 'availability' ? t('admin.settings.agenda.subtitle') : t('admin.settings.subtitle')}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('admin.settings.loading')}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTab)}
        className="space-y-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 w-full overflow-x-auto pb-1 sm:w-auto">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 lg:flex lg:justify-start">
              <TabsTrigger value="identity" className="min-h-10 whitespace-normal">
                {t('admin.settings.tabs.identity')}
              </TabsTrigger>
              <TabsTrigger value="operations" className="min-h-10 whitespace-normal">
                {t('admin.settings.tabs.operations')}
              </TabsTrigger>
              <TabsTrigger value="availability" className="min-h-10 whitespace-normal">
                {t('admin.settings.tabs.availability')}
              </TabsTrigger>
              <TabsTrigger value="extraordinary-openings" className="min-h-10 whitespace-normal">
                {t('admin.settings.tabs.extraordinaryOpenings')}
              </TabsTrigger>
            </TabsList>
          </div>
          {activeTab !== 'extraordinary-openings' && (
            <div className="flex flex-wrap items-center gap-2 md:shrink-0">
              <div ref={setAgendaActionsContainer} hidden={activeTab !== 'availability'} />
              {activeTab !== 'availability' && <Button onClick={handleSave} disabled={isCurrentTabSaveDisabled}>
                {isCurrentTabSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Settings className="w-4 h-4 mr-2" />
                {t('admin.settings.saveChanges')}
              </Button>}
            </div>
          )}
        </div>

        <TabsContent value="identity" className="mt-0 space-y-6">
      {invoicingEnabled && (
        <Card variant="elevated" className="border-primary/20">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t('admin.settings.invoicing.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('admin.settings.invoicing.description')}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void handleSaveInvoiceLegal()}
              disabled={invoiceLegalQuery.isLoading || isSavingInvoiceLegal}
              className="md:shrink-0"
            >
              {isSavingInvoiceLegal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.settings.invoicing.save')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoiceLegalQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('admin.settings.invoicing.loading')}
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-legal-name">{t('admin.settings.invoicing.legalName')}</Label>
                    <Input
                      id="invoice-legal-name"
                      value={invoiceLegal.legalOwnerName}
                      onChange={(event) => setInvoiceLegal((current) => ({
                        ...current,
                        legalOwnerName: event.target.value,
                      }))}
                      maxLength={160}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-tax-id">{t('admin.settings.invoicing.taxId')}</Label>
                    <Input
                      id="invoice-tax-id"
                      value={invoiceLegal.legalOwnerTaxId || ''}
                      onChange={(event) => setInvoiceLegal((current) => ({
                        ...current,
                        legalOwnerTaxId: event.target.value,
                      }))}
                      maxLength={80}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-address">{t('admin.settings.invoicing.address')}</Label>
                  <Input
                    id="invoice-address"
                    value={invoiceLegal.legalOwnerAddress || ''}
                    onChange={(event) => setInvoiceLegal((current) => ({
                      ...current,
                      legalOwnerAddress: event.target.value,
                    }))}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_100px]">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-email">{t('admin.settings.invoicing.email')}</Label>
                    <Input
                      id="invoice-email"
                      type="email"
                      value={invoiceLegal.legalContactEmail || ''}
                      onChange={(event) => setInvoiceLegal((current) => ({
                        ...current,
                        legalContactEmail: event.target.value,
                      }))}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-phone">{t('admin.settings.invoicing.phone')}</Label>
                    <Input
                      id="invoice-phone"
                      value={invoiceLegal.legalContactPhone || ''}
                      onChange={(event) => setInvoiceLegal((current) => ({
                        ...current,
                        legalContactPhone: event.target.value,
                      }))}
                      maxLength={40}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-country">{t('admin.settings.invoicing.country')}</Label>
                    <Input
                      id="invoice-country"
                      value={invoiceLegal.country || 'ES'}
                      onChange={(event) => setInvoiceLegal((current) => ({
                        ...current,
                        country: event.target.value.toUpperCase().slice(0, 2),
                      }))}
                      maxLength={2}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.settings.invoicing.requiredHint')}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
      {/* Branding & Location */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t('admin.settings.section.identityMessage')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.settings.identity.fields.locationName', { locationFromWithDefinite: copy.location.fromWithDefinite })}</Label>
                <Input
                  value={settings.branding.name}
                  onChange={(e) => handleBrandingChange('name', e.target.value)}
                  placeholder="Le Blond Hair Salon"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.settings.identity.fields.shortName')}</Label>
                <Input
                  value={settings.branding.shortName}
                  onChange={(e) => handleBrandingChange('shortName', e.target.value)}
                  placeholder="Le Blond"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.settings.identity.fields.tagline')}</Label>
                <InlineTranslationPopover
                  entityType="site_settings"
                  entityId={currentLocationId}
                  fieldKey="branding.tagline"
                  onUpdated={async () => {
                    await settingsQuery.refetch();
                  }}
                />
              </div>
              <Input
                value={settings.branding.tagline}
                onChange={(e) => handleBrandingChange('tagline', e.target.value)}
                placeholder={t('admin.settings.identity.placeholders.tagline')}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{t('admin.settings.identity.fields.shortDescription')}</Label>
                  <InlineTranslationPopover
                    entityType="site_settings"
                    entityId={currentLocationId}
                    fieldKey="branding.description"
                    onUpdated={async () => {
                      await settingsQuery.refetch();
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {settings.branding.description.length}/150
                </span>
              </div>
              <Textarea
                value={settings.branding.description}
                onChange={(e) =>
                  handleBrandingChange('description', e.target.value.slice(0, 150))
                }
                placeholder={t('admin.settings.identity.placeholders.shortDescription')}
                maxLength={150}
                rows={3}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 leading-tight">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {t('admin.settings.identity.fields.visibleLocation')}
                </Label>
                <InlineTranslationPopover
                  entityType="site_settings"
                  entityId={currentLocationId}
                  fieldKey="location.label"
                  onUpdated={async () => {
                    await settingsQuery.refetch();
                  }}
                />
              </div>
              <Input
                value={settings.location.label}
                onChange={(e) => handleLocationChange('label', e.target.value)}
                placeholder="Le Blond Hair Salon, Canet d'en Berenguer"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {t('admin.settings.identity.contactAndSocial')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.settings.identity.fields.phone')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={PHONE_PREFIX}
                    placeholder="+34"
                    readOnly
                    disabled
                    aria-readonly="true"
                  />
                  <Input
                    className="col-span-2"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="656 610 045"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.settings.identity.fields.email')}</Label>
                <Input
                  value={settings.contact.email}
                  onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, email: e.target.value } }))}
                  placeholder="contacto@leblond.com"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 leading-tight">
                  <Link2 className="w-4 h-4 text-muted-foreground" />
                  {t('admin.settings.identity.fields.googleMapsUrl')}
                </Label>
                <Input
                  value={settings.location.mapUrl}
                  onChange={(e) => handleLocationChange('mapUrl', e.target.value)}
                  placeholder="https://maps.google.com/..."
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 leading-tight">
                  <Globe2 className="w-4 h-4 text-muted-foreground" />
                  {t('admin.settings.identity.fields.mapEmbedUrl')}
                </Label>
                <Input
                  value={settings.location.mapEmbedUrl}
                  onChange={(e) => handleLocationChange('mapEmbedUrl', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?..."
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-3">{t('admin.settings.identity.social.title')}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Instagram className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.instagram}
                    onChange={(e) => handleSocialChange('instagram', e.target.value)}
                    placeholder={t('admin.settings.identity.social.instagramPlaceholder')}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <XBrandIcon className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.x}
                    onChange={(e) => handleSocialChange('x', e.target.value)}
                    placeholder={t('admin.settings.identity.social.xPlaceholder')}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Music2 className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.tiktok}
                    onChange={(e) => handleSocialChange('tiktok', e.target.value)}
                    placeholder={t('admin.settings.identity.social.tiktokPlaceholder')}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Youtube className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.youtube}
                    onChange={(e) => handleSocialChange('youtube', e.target.value)}
                    placeholder={t('admin.settings.identity.social.youtubePlaceholder')}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Linkedin className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.linkedin}
                    onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                    placeholder={t('admin.settings.identity.social.linkedinPlaceholder')}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            <CardTitle>{t('admin.settings.stats.title')}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('admin.settings.stats.description')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.settings.stats.fields.startYear')}</Label>
                <Switch
                  checked={statsVisibility.experienceYears}
                  onCheckedChange={(checked) =>
                    handleStatsVisibilityChange('experienceYears', checked)
                  }
                  disabled={isLoading}
                />
              </div>
              <Input
                type="number"
                value={settings.stats.experienceStartYear}
                onChange={(e) => handleStatsChange('experienceStartYear', parseInt(e.target.value, 10) || settings.stats.experienceStartYear)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.settings.stats.fields.averageRating')}</Label>
                <Switch
                  checked={statsVisibility.averageRating}
                  onCheckedChange={(checked) =>
                    handleStatsVisibilityChange('averageRating', checked)
                  }
                  disabled={isLoading}
                />
              </div>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={settings.stats.averageRating}
                onChange={(e) => handleStatsChange('averageRating', parseFloat(e.target.value) || 0)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.settings.stats.fields.yearlyBookings')}</Label>
                <Switch
                  checked={statsVisibility.yearlyBookings}
                  onCheckedChange={(checked) =>
                    handleStatsVisibilityChange('yearlyBookings', checked)
                  }
                  disabled={isLoading}
                />
              </div>
              <Input
                type="number"
                min={0}
                value={settings.stats.yearlyBookings}
                onChange={(e) => handleStatsChange('yearlyBookings', parseInt(e.target.value, 10) || 0)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.settings.stats.fields.repeatClientsPercentage')}</Label>
                <Switch
                  checked={statsVisibility.repeatClientsPercentage}
                  onCheckedChange={(checked) =>
                    handleStatsVisibilityChange('repeatClientsPercentage', checked)
                  }
                  disabled={isLoading}
                />
              </div>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.stats.repeatClientsPercentage}
                onChange={(e) =>
                  handleStatsChange(
                    'repeatClientsPercentage',
                    Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                  )
                }
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            {statsPreviewItems.map((stat) => {
              const isVisible = statsVisibility[stat.key as keyof typeof statsVisibility] !== false;

              return (
                <div
                  key={stat.label}
                  className={`rounded-xl border border-border/80 px-3 py-3 flex items-center gap-3 transition ${
                    isVisible ? 'bg-muted/40' : 'bg-muted/20 opacity-70'
                  }`}
                >
                  <stat.icon className="w-4 h-4 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      {!isVisible && (
                        <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t('admin.settings.stats.hiddenOnLanding')}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-foreground leading-tight">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="operations" className="mt-0 space-y-6">

      {multiServiceCapabilityEnabled && (
        <Card variant="elevated" className="border-primary/20">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>{t('admin.settings.multiService.title')}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin.settings.multiService.description')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('admin.settings.multiService.toggleTitle')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.settings.multiService.toggleDescription')}
                </p>
              </div>
              <Switch
                checked={settings.appointments.multiServiceEnabled === true}
                onCheckedChange={(checked) =>
                  setSettings((current) => ({
                    ...current,
                    appointments: {
                      ...current.appointments,
                      multiServiceEnabled: checked,
                    },
                  }))
                }
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {stripeConfig && stripeVisible && (
        <Card variant="elevated">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <CardTitle>{t('admin.settings.stripe.title')}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin.settings.stripe.description')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('admin.settings.stripe.enableForLocation', { locationDefiniteSingular: copy.location.definiteSingular })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stripeConfig.brandEnabled
                    ? t('admin.settings.stripe.enableHint', { locationDefiniteSingular: copy.location.definiteSingular })
                    : t('admin.settings.stripe.brandDisabled')}
                </p>
              </div>
              <Switch
                checked={stripeConfig.localEnabled}
                onCheckedChange={handleStripeToggle}
                disabled={!stripeConfig.brandEnabled || isStripeSaving || isStripeLoading}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t('admin.settings.stripe.labels.status')}</p>
                <p className="text-sm font-semibold text-foreground">{stripeStatusLabel}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t('admin.settings.stripe.labels.mode')}</p>
                <p className="text-sm font-semibold text-foreground">{stripeModeLabel}</p>
              </div>
            </div>

            {stripeConfig.brandEnabled && stripeConfig.localEnabled && stripeConfig.mode === 'location' && !stripeReady && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('admin.settings.stripe.connect.title')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.settings.stripe.connect.description')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleStripeConnect}
                  disabled={isStripeConnecting}
                >
                  {isStripeConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('admin.settings.stripe.connect.action')}
                </Button>
              </div>
            )}

            {stripeConfig.brandEnabled && stripeConfig.mode === 'brand' && !stripeReady && (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
                {t('admin.settings.stripe.brandModePending')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isStripeLoading && stripeVisible && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('admin.settings.stripe.loading')}
        </div>
      )}

      {/* Products */}
      {productsModuleEnabled && (
        <Card variant="elevated">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-primary" />
              <CardTitle>{t('admin.settings.products.title')}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin.settings.products.description')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t('admin.settings.products.clientPurchase.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.settings.products.clientPurchase.description')}</p>
                </div>
                <Switch
                  checked={settings.products.clientPurchaseEnabled}
                  aria-label={t('admin.settings.products.clientPurchase.title')}
                  onCheckedChange={(checked) =>
                    setSettings((current) => ({ ...current, products: { ...current.products, clientPurchaseEnabled: checked } }))
                  }
                  disabled={isLoading || isSaving || isSavingSchedule}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t('admin.settings.products.showOnLanding.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.settings.products.showOnLanding.description')}</p>
                </div>
                <Switch
                  checked={settings.products.showOnLanding}
                  aria-label={t('admin.settings.products.showOnLanding.title')}
                  onCheckedChange={(checked) =>
                    setSettings((current) => ({ ...current, products: { ...current.products, showOnLanding: checked } }))
                  }
                  disabled={isLoading || isSaving || isSavingSchedule}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            <CardTitle>{t('admin.settings.profile.title')}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('admin.settings.profile.description')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t('admin.settings.profile.phoneRequired.title')}</p>
              <p className="text-xs text-muted-foreground">{t('admin.settings.profile.phoneRequired.description')}</p>
            </div>
            <Switch
              checked={settings.profile?.phoneRequired === true}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  profile: {
                    ...(prev.profile ?? DEFAULT_SITE_SETTINGS.profile),
                    phoneRequired: checked,
                  },
                }))
              }
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cancellation policy */}
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle>{t('admin.settings.cancellation.title')}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('admin.settings.cancellation.description')}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 max-w-xs">
              <Label>{t('admin.settings.cancellation.cutoffHours')}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={settings.appointments.cancellationCutoffHours}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    appointments: {
                      ...prev.appointments,
                      cancellationCutoffHours: Math.max(0, parseInt(e.target.value, 10) || 0),
                    },
                  }))
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.cancellation.cutoffHint')}
              </p>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label>{t('admin.settings.cancellation.slotInterval')}</Label>
              <Select
                value={String(settings.appointments.slotIntervalMinutes ?? 15)}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    appointments: {
                      ...prev.appointments,
                      slotIntervalMinutes: value === '30' ? 30 : 15,
                    },
                  }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">{t('admin.settings.cancellation.slotInterval.15')}</SelectItem>
                  <SelectItem value="30">{t('admin.settings.cancellation.slotInterval.30')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.cancellation.slotIntervalHint')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="availability" forceMount hidden={activeTab !== 'availability'} className="mt-0">
          <AgendaSettings
            key={currentLocationId ?? 'no-local'}
            localId={currentLocationId}
            schedule={scheduleQuery.data}
            openingHours={settingsQuery.data?.openingHours}
            isLoading={isLoading || isScheduleLoading}
            isSaving={isSavingAvailability || isSavingSchedule}
            loadFailed={Boolean(settingsQuery.error || scheduleQuery.error)}
            permissionDenied={[settingsQuery.error, scheduleQuery.error].some((error) => isApiRequestError(error) && error.status === 403)}
            onRetry={() => { void settingsQuery.refetch(); void scheduleQuery.refetch(); }}
            onSave={handleSaveAvailabilityAndSchedule}
            actionsContainer={agendaActionsContainer}
          />
        </TabsContent>

        <TabsContent value="extraordinary-openings" className="mt-0 space-y-6">
          <ExtraordinaryOpeningsSettings
            openings={shopSchedule?.extraordinaryOpenings ?? {}}
            isLoading={isScheduleLoading || !shopSchedule}
            onOpeningsUpdated={handleExtraordinaryOpeningsUpdated}
          />
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default AdminSettings;
