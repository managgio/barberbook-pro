import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { AdminStripeConfig, BreakRange, DayKey, ShopSchedule, SiteSettings } from '@/data/types';
import { getShopSchedule, updateShopSchedule } from '@/data/api/schedules';
import { updateSiteSettings } from '@/data/api/settings';
import { createAdminStripeConnect, getAdminStripeConfig, updateAdminStripeConfig } from '@/data/api/payments';
import { useToast } from '@/hooks/use-toast';
import { composePhone, normalizePhoneParts } from '@/lib/siteSettings';
import { useTenant } from '@/context/TenantContext';
import { dispatchSchedulesUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { useBusinessCopy } from '@/lib/businessCopy';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Plus,
  Trash2,
  Instagram,
  Music2,
  Youtube,
  Linkedin,
  Boxes,
  CreditCard,
} from 'lucide-react';

const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const SHIFT_KEYS = ['morning', 'afternoon'] as const;
type ShiftKey = (typeof SHIFT_KEYS)[number];
type SettingsTab = 'identity' | 'operations' | 'availability';

const cloneSettings = (data: SiteSettings): SiteSettings => JSON.parse(JSON.stringify(data));
const DEFAULT_BREAK_RANGE: BreakRange = { start: '13:30', end: '14:00' };
const SETTINGS_TAB_STORAGE_KEY = 'admin-settings-active-tab';
const SETTINGS_TABS: SettingsTab[] = ['identity', 'operations', 'availability'];
const PHONE_PREFIX = '+34';

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
  const copy = useBusinessCopy();
  const productsModuleEnabled = !tenant?.config?.adminSidebar?.hiddenSections?.includes('stock');
  const [settings, setSettings] = useState<SiteSettings>(() => cloneSettings(DEFAULT_SITE_SETTINGS));
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [shopSchedule, setShopSchedule] = useState<ShopSchedule | null>(null);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isStripeSaving, setIsStripeSaving] = useState(false);
  const [isStripeConnecting, setIsStripeConnecting] = useState(false);
  const [newOverflowDate, setNewOverflowDate] = useState('');
  const [newBreakDate, setNewBreakDate] = useState('');
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined') return 'identity';
    const saved = window.sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
    return SETTINGS_TABS.includes(saved as SettingsTab) ? (saved as SettingsTab) : 'identity';
  });
  const [{ number: phoneNumber }, setPhoneParts] = useState(() => ({
    prefix: PHONE_PREFIX,
    number: normalizePhoneParts(DEFAULT_SITE_SETTINGS.contact.phone).number,
  }));
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
  const isLoading = settingsQuery.isLoading;
  const isScheduleLoading = scheduleQuery.isLoading;
  const isStripeLoading = stripeConfigQuery.isLoading;
  const stripeConfig = stripeConfigQuery.data ?? null;

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettings(cloneSettings(settingsQuery.data));
    setPhoneParts({
      prefix: PHONE_PREFIX,
      number: normalizePhoneParts(settingsQuery.data.contact.phone).number,
    });
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!scheduleQuery.data) return;
    setShopSchedule(scheduleQuery.data);
  }, [scheduleQuery.data]);

  useEffect(() => {
    if (!settingsQuery.error) return;
    toast({
      title: 'No se pudo cargar la configuración',
      description: 'Intenta de nuevo en unos segundos.',
      variant: 'destructive',
    });
  }, [settingsQuery.error, toast]);

  useEffect(() => {
    if (!scheduleQuery.error) return;
    toast({
      title: 'No se pudo cargar la disponibilidad',
      description: 'Intenta de nuevo en unos segundos.',
      variant: 'destructive',
    });
  }, [scheduleQuery.error, toast]);

  useEffect(() => {
    if (!stripeConfigQuery.error) return;
    toast({
      title: 'No se pudo cargar Stripe',
      description: 'Revisa la conexión e intenta de nuevo.',
      variant: 'destructive',
    });
  }, [stripeConfigQuery.error, toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const buildSettingsPayload = (nextSettings: SiteSettings) => {
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    const phone = cleanPhoneNumber ? composePhone(PHONE_PREFIX, cleanPhoneNumber) : '';
    const payload: SiteSettings = {
      ...nextSettings,
      contact: { ...nextSettings.contact, phone },
      socials: { ...nextSettings.socials },
    };
    Object.entries(payload.socials).forEach(([key, value]) => {
      payload.socials[key as keyof SiteSettings['socials']] = value?.trim() || '';
    });
    return payload;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = buildSettingsPayload(settings);
      const updated = await updateSiteSettings(payload);
      setSettings(updated);
      setPhoneParts({
        prefix: PHONE_PREFIX,
        number: normalizePhoneParts(updated.contact.phone).number,
      });
      dispatchSiteSettingsUpdated(updated);
      toast({
        title: 'Configuración actualizada',
        description: 'Los cambios se han guardado correctamente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Revisa los campos e intenta nuevamente.';
      toast({
        title: 'Error al guardar',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveProductsPreference = async (nextProducts: SiteSettings['products']) => {
    if (isLoading || isSaving || isSavingSchedule) return;
    const nextSettings = { ...settings, products: nextProducts };
    setSettings(nextSettings);
    setIsSaving(true);
    try {
      const payload = buildSettingsPayload(nextSettings);
      const updated = await updateSiteSettings(payload);
      setSettings(updated);
      setPhoneParts({
        prefix: PHONE_PREFIX,
        number: normalizePhoneParts(updated.contact.phone).number,
      });
      dispatchSiteSettingsUpdated(updated);
      toast({
        title: 'Preferencias actualizadas',
        description: 'Los cambios se han guardado correctamente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar los cambios.';
      toast({
        title: 'Error al guardar',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStripeToggle = async (enabled: boolean) => {
    if (!stripeConfig || isStripeSaving) return;
    setIsStripeSaving(true);
    try {
      await updateAdminStripeConfig(enabled);
      await stripeConfigQuery.refetch();
      toast({
        title: 'Preferencias de pago actualizadas',
        description: enabled
          ? `Stripe quedó habilitado para ${copy.location.definiteSingular}.`
          : `Stripe quedó deshabilitado para ${copy.location.definiteSingular}.`,
      });
    } catch (error) {
      toast({
        title: 'No se pudo actualizar Stripe',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
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
        title: 'No se pudo iniciar Stripe',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsStripeConnecting(false);
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

  const ensureBreaksRecord = (current?: Record<DayKey, BreakRange[]>) =>
    DAY_LABELS.reduce((acc, { key }) => {
      acc[key] = current?.[key] ? [...current[key]] : [];
      return acc;
    }, {} as Record<DayKey, BreakRange[]>);

  const ensureEndOverflowByDayRecord = (current?: Partial<Record<DayKey, number>>) =>
    DAY_LABELS.reduce((acc, { key }) => {
      const value = current?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = Math.max(0, Math.floor(value));
      }
      return acc;
    }, {} as Partial<Record<DayKey, number>>);

  const ensureEndOverflowByDateRecord = (current?: Record<string, number>) => {
    if (!current || typeof current !== 'object') return {};
    return Object.entries(current).reduce((acc, [dateKey, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return acc;
      if (typeof value !== 'number' || !Number.isFinite(value)) return acc;
      acc[dateKey] = Math.max(0, Math.floor(value));
      return acc;
    }, {} as Record<string, number>);
  };

  const ensureBreaksByDateRecord = (current?: Record<string, BreakRange[]>) => {
    if (!current || typeof current !== 'object') return {};
    return Object.entries(current).reduce((acc, [dateKey, ranges]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Array.isArray(ranges)) return acc;
      acc[dateKey] = ranges.map((range) => ({ ...range }));
      return acc;
    }, {} as Record<string, BreakRange[]>);
  };

  const handleBufferMinutesChange = (value: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      if (value.trim() === '') {
        return { ...prev, bufferMinutes: undefined };
      }
      const parsed = Math.max(0, Math.floor(Number(value)));
      return { ...prev, bufferMinutes: Number.isFinite(parsed) ? parsed : prev.bufferMinutes };
    });
  };

  const handleEndOverflowMinutesChange = (value: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      if (value.trim() === '') {
        return { ...prev, endOverflowMinutes: undefined };
      }
      const parsed = Math.max(0, Math.floor(Number(value)));
      return { ...prev, endOverflowMinutes: Number.isFinite(parsed) ? parsed : prev.endOverflowMinutes };
    });
  };

  const handleEndOverflowByDayChange = (day: DayKey, value: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const nextByDay = ensureEndOverflowByDayRecord(prev.endOverflowByDay);
      if (value.trim() === '') {
        delete nextByDay[day];
      } else {
        const parsed = Math.max(0, Math.floor(Number(value)));
        if (Number.isFinite(parsed)) {
          nextByDay[day] = parsed;
        }
      }
      return { ...prev, endOverflowByDay: nextByDay };
    });
  };

  const handleAddEndOverflowDate = (dateKey: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const nextByDate = ensureEndOverflowByDateRecord(prev.endOverflowByDate);
      if (nextByDate[dateKey] !== undefined) return prev;
      nextByDate[dateKey] = Math.max(0, Math.floor(prev.endOverflowMinutes ?? 0));
      return { ...prev, endOverflowByDate: nextByDate };
    });
  };

  const handleEndOverflowByDateChange = (dateKey: string, value: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const nextByDate = ensureEndOverflowByDateRecord(prev.endOverflowByDate);
      if (value.trim() === '') {
        delete nextByDate[dateKey];
      } else {
        const parsed = Math.max(0, Math.floor(Number(value)));
        if (Number.isFinite(parsed)) {
          nextByDate[dateKey] = parsed;
        }
      }
      return { ...prev, endOverflowByDate: nextByDate };
    });
  };

  const handleRemoveEndOverflowDate = (dateKey: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const nextByDate = ensureEndOverflowByDateRecord(prev.endOverflowByDate);
      if (nextByDate[dateKey] === undefined) return prev;
      delete nextByDate[dateKey];
      return { ...prev, endOverflowByDate: nextByDate };
    });
  };

  const handleAddBreak = (day: DayKey) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaks = ensureBreaksRecord(prev.breaks);
      const newRange = { ...DEFAULT_BREAK_RANGE };
      breaks[day] = [...breaks[day], { ...newRange }];
      return { ...prev, breaks };
    });
  };

  const handleCopyBreaksToAll = (day: DayKey) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaks = ensureBreaksRecord(prev.breaks);
      const source = breaks[day].map((range) => ({ ...range }));
      DAY_LABELS.forEach(({ key }) => {
        breaks[key] = [...breaks[key], ...source.map((range) => ({ ...range }))];
      });
      return { ...prev, breaks };
    });
  };

  const handleUpdateBreak = (day: DayKey, index: number, field: 'start' | 'end', value: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaks = ensureBreaksRecord(prev.breaks);
      breaks[day] = breaks[day].map((range, idx) => (idx === index ? { ...range, [field]: value } : range));
      return { ...prev, breaks };
    });
  };

  const handleRemoveBreak = (day: DayKey, index: number) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaks = ensureBreaksRecord(prev.breaks);
      breaks[day] = breaks[day].filter((_, idx) => idx !== index);
      return { ...prev, breaks };
    });
  };

  const handleAddBreakDate = (dateKey: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaksByDate = ensureBreaksByDateRecord(prev.breaksByDate);
      if (!breaksByDate[dateKey]) {
        breaksByDate[dateKey] = [];
      }
      return { ...prev, breaksByDate };
    });
  };

  const handleAddBreakForDate = (dateKey: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaksByDate = ensureBreaksByDateRecord(prev.breaksByDate);
      const current = breaksByDate[dateKey] ?? [];
      breaksByDate[dateKey] = [...current, { ...DEFAULT_BREAK_RANGE }];
      return { ...prev, breaksByDate };
    });
  };

  const handleUpdateBreakByDate = (dateKey: string, index: number, field: 'start' | 'end', value: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaksByDate = ensureBreaksByDateRecord(prev.breaksByDate);
      const current = breaksByDate[dateKey] ?? [];
      breaksByDate[dateKey] = current.map((range, idx) => (idx === index ? { ...range, [field]: value } : range));
      return { ...prev, breaksByDate };
    });
  };

  const handleRemoveBreakByDate = (dateKey: string, index: number) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaksByDate = ensureBreaksByDateRecord(prev.breaksByDate);
      const current = breaksByDate[dateKey] ?? [];
      breaksByDate[dateKey] = current.filter((_, idx) => idx !== index);
      return { ...prev, breaksByDate };
    });
  };

  const handleRemoveBreakDate = (dateKey: string) => {
    setShopSchedule((prev) => {
      if (!prev) return prev;
      const breaksByDate = ensureBreaksByDateRecord(prev.breaksByDate);
      delete breaksByDate[dateKey];
      return { ...prev, breaksByDate };
    });
  };

  const handleSaveAvailabilityAndSchedule = async () => {
    if (!shopSchedule || isSavingAvailability || isSavingSchedule) return;
    setIsSavingAvailability(true);
    setIsSavingSchedule(true);
    try {
      const [updatedSchedule, updatedSettings] = await Promise.all([
        updateShopSchedule(shopSchedule),
        updateSiteSettings(buildSettingsPayload(settings)),
      ]);
      setShopSchedule(updatedSchedule);
      setSettings(updatedSettings);
      setPhoneParts({
        prefix: PHONE_PREFIX,
        number: normalizePhoneParts(updatedSettings.contact.phone).number,
      });
      await scheduleQuery.refetch();
      dispatchSchedulesUpdated({ source: 'admin-settings' });
      dispatchSiteSettingsUpdated(updatedSettings);
      toast({
        title: 'Agenda y horarios actualizados',
        description: 'La disponibilidad y el horario informativo se han guardado correctamente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar los cambios.';
      toast({
        title: 'Error al guardar',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingAvailability(false);
      setIsSavingSchedule(false);
    }
  };

  const handleSaveByActiveTab = async () => {
    if (activeTab === 'availability') {
      await handleSaveAvailabilityAndSchedule();
      return;
    }
    await handleSave();
  };

  const handleShiftTimeChange = (
    day: DayKey,
    shift: ShiftKey,
    field: 'start' | 'end',
    value: string,
  ) => {
    setSettings((prev) => {
      const dayData = prev.openingHours[day];
      const updatedDay = {
        ...dayData,
        [shift]: { ...dayData[shift], [field]: value },
      };
      return {
        ...prev,
        openingHours: { ...prev.openingHours, [day]: updatedDay },
      };
    });
  };

  const handleShiftToggle = (
    day: DayKey,
    shift: ShiftKey,
    enabled: boolean,
  ) => {
    setSettings((prev) => {
      const dayData = prev.openingHours[day];
      const updatedDay = {
        ...dayData,
        [shift]: { ...dayData[shift], enabled },
      };
      const closed = !updatedDay.morning.enabled && !updatedDay.afternoon.enabled;
      return {
        ...prev,
        openingHours: { ...prev.openingHours, [day]: { ...updatedDay, closed } },
      };
    });
  };

  const handleScheduleClosed = (day: DayKey, closed: boolean) => {
    setSettings((prev) => {
      const dayData = prev.openingHours[day];
      const updatedDay = {
        ...dayData,
        closed,
        morning: { ...dayData.morning, enabled: closed ? false : dayData.morning.enabled || true },
        afternoon: { ...dayData.afternoon, enabled: closed ? false : dayData.afternoon.enabled },
      };
      return {
        ...prev,
        openingHours: { ...prev.openingHours, [day]: updatedDay },
      };
    });
  };

  const experienceYears = Math.max(0, new Date().getFullYear() - settings.stats.experienceStartYear);
  const statsVisibility = settings.stats.visibility || {
    experienceYears: true,
    averageRating: true,
    yearlyBookings: true,
    repeatClientsPercentage: true,
  };
  const statsPreviewItems = [
    { key: 'experienceYears', icon: Sparkles, label: 'Años de experiencia', value: `${experienceYears}+` },
    { key: 'averageRating', icon: Star, label: 'Valoración media', value: settings.stats.averageRating.toFixed(1) },
    { key: 'yearlyBookings', icon: Calendar, label: 'Reservas/año', value: settings.stats.yearlyBookings.toLocaleString('es-ES') },
    { key: 'repeatClientsPercentage', icon: Repeat, label: 'Clientes que repiten', value: `${settings.stats.repeatClientsPercentage}%` },
  ];
  const stripeReady = Boolean(stripeConfig?.status?.chargesEnabled && stripeConfig?.status?.detailsSubmitted);
  const stripeStatusLabel = !stripeConfig?.brandEnabled
    ? 'Desactivado por la marca'
    : !stripeConfig?.platformEnabled
      ? 'Desactivado por la plataforma'
      : stripeConfig?.accountIdExists
        ? stripeReady
          ? 'Conectado'
          : 'Pendiente de completar'
        : 'Sin conectar';
  const stripeModeLabel = stripeConfig?.mode === 'brand'
    ? 'Cuenta centralizada de la marca'
    : `Cuenta propia por ${copy.location.singularLower}`;
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
          <h1 className="text-3xl font-bold text-foreground">Configuración general</h1>
          <p className="text-muted-foreground mt-1">
            Ajusta los datos públicos del sitio, las estadísticas destacadas y el horario de apertura.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando configuración...
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTab)}
        className="space-y-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto w-max justify-start gap-1 rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="identity" className="min-h-9 whitespace-nowrap">
                Identidad y landing
              </TabsTrigger>
              <TabsTrigger value="operations" className="min-h-9 whitespace-nowrap">
                Operativa
              </TabsTrigger>
              <TabsTrigger value="availability" className="min-h-9 whitespace-nowrap">
                Agenda y horarios
              </TabsTrigger>
            </TabsList>
          </div>
          <Button onClick={handleSaveByActiveTab} disabled={isCurrentTabSaveDisabled} className="md:shrink-0">
            {isCurrentTabSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Settings className="w-4 h-4 mr-2" />
            Guardar cambios
          </Button>
        </div>

        <TabsContent value="identity" className="mt-0 space-y-6">
      {/* Branding & Location */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Identidad y mensaje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre {copy.location.fromWithDefinite}</Label>
                <Input
                  value={settings.branding.name}
                  onChange={(e) => handleBrandingChange('name', e.target.value)}
                  placeholder="Le Blond Hair Salon"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre corto</Label>
                <Input
                  value={settings.branding.shortName}
                  onChange={(e) => handleBrandingChange('shortName', e.target.value)}
                  placeholder="Le Blond"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input
                value={settings.branding.tagline}
                onChange={(e) => handleBrandingChange('tagline', e.target.value)}
                placeholder="Tu look, nuestro compromiso."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descripción breve</Label>
                <span className="text-xs text-muted-foreground">
                  {settings.branding.description.length}/150
                </span>
              </div>
              <Textarea
                value={settings.branding.description}
                onChange={(e) =>
                  handleBrandingChange('description', e.target.value.slice(0, 150))
                }
                placeholder="Resumen corto de lo que hacéis (máx. 150 caracteres)"
                maxLength={150}
                rows={3}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 leading-tight">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Ubicación visible
              </Label>
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
              Contacto y redes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
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
                    onChange={(e) => setPhoneParts((prev) => ({ ...prev, number: e.target.value }))}
                    placeholder="656 610 045"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Correo</Label>
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
                  Enlace a Google Maps
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
                  Enlace para mapa visual (iframe)
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
              <p className="text-sm font-medium mb-3">Redes sociales</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Instagram className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.instagram}
                    onChange={(e) => handleSocialChange('instagram', e.target.value)}
                    placeholder="@usuario en Instagram"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <XBrandIcon className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.x}
                    onChange={(e) => handleSocialChange('x', e.target.value)}
                    placeholder="@usuario en X"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Music2 className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.tiktok}
                    onChange={(e) => handleSocialChange('tiktok', e.target.value)}
                    placeholder="@usuario en TikTok"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Youtube className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.youtube}
                    onChange={(e) => handleSocialChange('youtube', e.target.value)}
                    placeholder="Canal o usuario en YouTube"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3">
                  <Linkedin className="w-4 h-4 text-primary" />
                  <Input
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={settings.socials.linkedin}
                    onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                    placeholder="Usuario en LinkedIn"
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
            <CardTitle>Estadísticas destacadas</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Estas cifras aparecen en la landing.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Año de inicio</Label>
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
                <Label>Valoración media</Label>
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
                <Label>Reservas / año</Label>
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
                <Label>% clientes que repiten</Label>
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
                          Oculta en landing
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

      {/* Payments */}
      {stripeConfig && stripeVisible && (
        <Card variant="elevated">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <CardTitle>Pagos con tarjeta (Stripe)</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Activa los pagos online y permite al cliente pagar antes de la cita.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Habilitar Stripe en {copy.location.definiteSingular}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stripeConfig.brandEnabled
                    ? `Los clientes podrán elegir pagar online o en ${copy.location.definiteSingular}.`
                    : 'La marca no tiene Stripe activo.'}
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
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="text-sm font-semibold text-foreground">{stripeStatusLabel}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">Modo</p>
                <p className="text-sm font-semibold text-foreground">{stripeModeLabel}</p>
              </div>
            </div>

            {stripeConfig.brandEnabled && stripeConfig.localEnabled && stripeConfig.mode === 'location' && !stripeReady && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Conecta tu cuenta Stripe</p>
                  <p className="text-xs text-muted-foreground">
                    Necesitamos completar el onboarding para activar los cobros.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleStripeConnect}
                  disabled={isStripeConnecting}
                >
                  {isStripeConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Conectar Stripe
                </Button>
              </div>
            )}

            {stripeConfig.brandEnabled && stripeConfig.mode === 'brand' && !stripeReady && (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
                La cuenta de Stripe la gestiona la marca. Cuando la conexión esté lista, podrás habilitar pagos aquí.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isStripeLoading && stripeVisible && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando estado de Stripe...
        </div>
      )}

      {/* Products */}
      {productsModuleEnabled && (
        <Card variant="elevated">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-primary" />
              <CardTitle>Productos y stock</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Gestiona la visibilidad pública y la compra desde la app.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Compra de clientes</p>
                  <p className="text-xs text-muted-foreground">Permite añadir productos a la cita.</p>
                </div>
                <Switch
                  checked={settings.products.clientPurchaseEnabled}
                  onCheckedChange={(checked) =>
                    saveProductsPreference({ ...settings.products, clientPurchaseEnabled: checked })
                  }
                  disabled={isLoading || isSaving || isSavingSchedule}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Mostrar en landing</p>
                  <p className="text-xs text-muted-foreground">Sección pública de productos.</p>
                </div>
                <Switch
                  checked={settings.products.showOnLanding}
                  onCheckedChange={(checked) =>
                    saveProductsPreference({ ...settings.products, showOnLanding: checked })
                  }
                  disabled={isLoading || isSaving || isSavingSchedule}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancellation policy */}
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle>Política de cancelación</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Define con cuántas horas de antelación se puede cancelar una cita.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 max-w-xs">
            <Label>Horas mínimas antes de la cita</Label>
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
              Usa 0 si no quieres aplicar límite de cancelación.
            </p>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="availability" className="mt-0 space-y-6">

      {/* Breaks and buffers */}
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Descansos y tiempos entre servicios
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Bloquea huecos en la agenda y añade minutos de preparación entre citas.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="space-y-2">
                <Label>Tiempo entre servicios (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={shopSchedule?.bufferMinutes ?? ''}
                  onChange={(e) => handleBufferMinutesChange(e.target.value)}
                  disabled={isScheduleLoading || !shopSchedule}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <p className="text-xs text-muted-foreground">
                  Se aplica {copy.staff.toWithDefinitePlural} para limpieza, preparación o descanso.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tolerancia fin de jornada (minutos)</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={shopSchedule?.endOverflowMinutes ?? ''}
                onChange={(e) => handleEndOverflowMinutesChange(e.target.value)}
                disabled={isScheduleLoading || !shopSchedule}
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="text-xs text-muted-foreground">
                Permite reservar si la cita termina unos minutos después del cierre.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Tolerancia por día y fecha</p>
              <p className="text-xs text-muted-foreground">
                Prioridad de aplicación: fecha concreta, luego día de semana y después global.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tolerancia por día de semana
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {DAY_LABELS.map(({ key, label }) => (
                <div key={`overflow-day-${key}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={shopSchedule?.endOverflowByDay?.[key] ?? ''}
                    placeholder="Hereda global"
                    onChange={(e) => handleEndOverflowByDayChange(key, e.target.value)}
                    disabled={isScheduleLoading || !shopSchedule}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
              ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tolerancia por fecha concreta
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nueva fecha</Label>
                    <Input
                      type="date"
                      value={newOverflowDate}
                      onChange={(e) => setNewOverflowDate(e.target.value)}
                      disabled={isScheduleLoading || !shopSchedule}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      handleAddEndOverflowDate(newOverflowDate);
                      setNewOverflowDate('');
                    }}
                    disabled={!newOverflowDate || isScheduleLoading || !shopSchedule}
                  >
                    Añadir fecha
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(shopSchedule?.endOverflowByDate ?? {})
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateKey, value]) => (
                    <div
                      key={`overflow-date-${dateKey}`}
                      className="grid items-end gap-2 rounded-lg border border-border/60 bg-background/80 p-2.5 sm:grid-cols-[minmax(120px,1fr)_minmax(90px,120px)_auto]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{dateKey}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Minutos</Label>
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={value}
                          onChange={(e) => handleEndOverflowByDateChange(dateKey, e.target.value)}
                          disabled={isScheduleLoading || !shopSchedule}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="sm:justify-self-end"
                        onClick={() => handleRemoveEndOverflowDate(dateKey)}
                        disabled={isScheduleLoading || !shopSchedule}
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                {Object.keys(shopSchedule?.endOverflowByDate ?? {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay fechas con tolerancia específica.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Huecos por día</p>
              <p className="text-xs text-muted-foreground">Añade tantos huecos como necesites.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {DAY_LABELS.map(({ key, label }) => {
              const dayBreaks = shopSchedule?.breaks?.[key] ?? [];
              return (
                <div key={key} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {dayBreaks.length ? `${dayBreaks.length} huecos` : 'Sin huecos definidos'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyBreaksToAll(key)}
                        disabled={isScheduleLoading || !shopSchedule}
                      >
                        Copiar a toda la semana
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddBreak(key)}
                        disabled={isScheduleLoading || !shopSchedule}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Añadir hueco
                      </Button>
                    </div>
                  </div>

                  {dayBreaks.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {dayBreaks.map((range, index) => (
                        <div key={`${key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <Input
                            type="time"
                            value={range.start}
                            onChange={(e) => handleUpdateBreak(key, index, 'start', e.target.value)}
                            disabled={isScheduleLoading || !shopSchedule}
                          />
                          <Input
                            type="time"
                            value={range.end}
                            onChange={(e) => handleUpdateBreak(key, index, 'end', e.target.value)}
                            disabled={isScheduleLoading || !shopSchedule}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBreak(key, index)}
                            disabled={isScheduleLoading || !shopSchedule}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">No hay huecos configurados.</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Huecos por fecha concreta</p>
                <p className="text-xs text-muted-foreground">Añade descansos solo para una fecha puntual.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nueva fecha</Label>
                  <Input
                    type="date"
                    value={newBreakDate}
                    onChange={(e) => setNewBreakDate(e.target.value)}
                    disabled={isScheduleLoading || !shopSchedule}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleAddBreakDate(newBreakDate);
                    setNewBreakDate('');
                  }}
                  disabled={!newBreakDate || isScheduleLoading || !shopSchedule}
                >
                  Añadir fecha
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {Object.entries(shopSchedule?.breaksByDate ?? {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateKey, ranges]) => (
                  <div key={`break-date-${dateKey}`} className="space-y-2 rounded-lg border border-border/60 bg-background/85 p-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{dateKey}</p>
                        <p className="text-xs text-muted-foreground">
                          {ranges.length ? `${ranges.length} huecos` : 'Sin huecos definidos'}
                        </p>
                      </div>
                      <div className="flex gap-2 sm:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBreakForDate(dateKey)}
                          disabled={isScheduleLoading || !shopSchedule}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Añadir hueco
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBreakDate(dateKey)}
                          disabled={isScheduleLoading || !shopSchedule}
                        >
                          Quitar fecha
                        </Button>
                      </div>
                    </div>

                    {ranges.length > 0 ? (
                      <div className="space-y-2">
                        {ranges.map((range, index) => (
                          <div
                            key={`break-date-${dateKey}-${index}`}
                            className="grid items-center gap-2 rounded-md bg-muted/20 p-2 sm:grid-cols-[1fr_1fr_auto]"
                          >
                            <Input
                              type="time"
                              value={range.start}
                              onChange={(e) => handleUpdateBreakByDate(dateKey, index, 'start', e.target.value)}
                              disabled={isScheduleLoading || !shopSchedule}
                            />
                            <Input
                              type="time"
                              value={range.end}
                              onChange={(e) => handleUpdateBreakByDate(dateKey, index, 'end', e.target.value)}
                              disabled={isScheduleLoading || !shopSchedule}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveBreakByDate(dateKey, index)}
                              disabled={isScheduleLoading || !shopSchedule}
                              className="text-muted-foreground hover:text-foreground sm:justify-self-end"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No hay huecos configurados.</p>
                    )}
                  </div>
                ))}
              {Object.keys(shopSchedule?.breaksByDate ?? {}).length === 0 && (
                <p className="text-xs text-muted-foreground">No hay fechas con huecos específicos.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening hours */}
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Horario de apertura (informativo)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Este horario se muestra en la web y es independiente de la disponibilidad {copy.staff.fromWithDefinitePlural}.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 xl:grid-cols-3">
            {DAY_LABELS.map(({ key, label }) => {
              const day = settings.openingHours[key];
              return (
                <div key={key} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{day.closed ? 'Cerrado' : 'Abierto'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Cerrar día</span>
                      <Switch
                        checked={day.closed}
                        onCheckedChange={(checked) => handleScheduleClosed(key, checked)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {!day.closed && (
                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                      {SHIFT_KEYS.map((shift) => (
                        <div key={shift} className="rounded-lg border border-border/60 bg-background/80 p-3">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <p className="text-sm font-medium">
                              {shift === 'morning' ? 'Turno de mañana' : 'Turno de tarde'}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Activo</span>
                              <Switch
                                checked={day[shift].enabled}
                                onCheckedChange={(checked) => handleShiftToggle(key, shift, checked)}
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                          {day[shift].enabled ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Inicio</Label>
                                <Input
                                  type="time"
                                  value={day[shift].start}
                                  onChange={(e) => handleShiftTimeChange(key, shift, 'start', e.target.value)}
                                  disabled={isLoading}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Fin</Label>
                                <Input
                                  type="time"
                                  value={day[shift].end}
                                  onChange={(e) => handleShiftTimeChange(key, shift, 'end', e.target.value)}
                                  disabled={isLoading}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Turno desactivado.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
