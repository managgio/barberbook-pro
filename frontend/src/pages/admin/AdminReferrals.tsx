import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useBusinessCopy } from '@/lib/businessCopy';
import {
  getReferralConfig,
  updateReferralConfig,
  copyReferralConfig,
  getReferralOverview,
  getReferralList,
} from '@/data/api/referrals';
import { ReferralProgramConfig, Service, ReferralAttributionItem, RewardType } from '@/data/types';
import { Award, Copy, Users, TrendingUp, Info } from 'lucide-react';
import { fetchServicesCached } from '@/lib/catalogQuery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useI18n } from '@/hooks/useI18n';

const rewardTypeOptions = [
  { value: 'WALLET', labelKey: 'admin.referrals.rewardType.wallet' },
  { value: 'PERCENT_DISCOUNT', labelKey: 'admin.referrals.rewardType.percentDiscount' },
  { value: 'FIXED_DISCOUNT', labelKey: 'admin.referrals.rewardType.fixedDiscount' },
  { value: 'FREE_SERVICE', labelKey: 'admin.referrals.rewardType.freeService' },
] as const;
const LIST_PAGE = 1;
const LIST_PAGE_SIZE = 25;
const LIST_QUERY_DEBOUNCE_MS = 250;
const EMPTY_SERVICES: Service[] = [];
const EMPTY_REFERRAL_LIST: { total: number; items: ReferralAttributionItem[] } = { total: 0, items: [] };
type ReferralOverview = {
  invites?: number;
  pending?: number;
  confirmed?: number;
  revenueAttributable?: number;
  topAmbassadors?: Array<{
    userId: string;
    name?: string;
    email?: string;
    count: number;
  }>;
};

const AdminReferrals: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const { locations, currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const copy = useBusinessCopy();
  const [config, setConfig] = useState<ReferralProgramConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedCopyLocation, setSelectedCopyLocation] = useState<string>('');
  const [listStatus, setListStatus] = useState<string>('all');
  const [listQuery, setListQuery] = useState('');
  const [debouncedListQuery, setDebouncedListQuery] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoKey, setInfoKey] = useState<'expiry' | 'newCustomer' | 'monthlyLimit' | 'allowedServices' | 'rewardReferrer' | 'rewardReferred' | 'antiFraud' | null>(null);

  const infoContent = useMemo(
    () =>
      ({
        expiry: {
          title: t('admin.referrals.info.expiry.title'),
          body: t('admin.referrals.info.expiry.body'),
        },
        newCustomer: {
          title: t('admin.referrals.info.newCustomer.title'),
          body: t('admin.referrals.info.newCustomer.body', {
            locationDefiniteSingular: copy.location.definiteSingular,
          }),
        },
        monthlyLimit: {
          title: t('admin.referrals.info.monthlyLimit.title'),
          body: t('admin.referrals.info.monthlyLimit.body'),
        },
        allowedServices: {
          title: t('admin.referrals.info.allowedServices.title'),
          body: t('admin.referrals.info.allowedServices.body'),
        },
        rewardReferrer: {
          title: t('admin.referrals.info.rewardReferrer.title'),
          body: t('admin.referrals.info.rewardReferrer.body'),
        },
        rewardReferred: {
          title: t('admin.referrals.info.rewardReferred.title'),
          body: t('admin.referrals.info.rewardReferred.body'),
        },
        antiFraud: {
          title: t('admin.referrals.info.antiFraud.title'),
          body: t('admin.referrals.info.antiFraud.body', {
            locationDefiniteSingular: copy.location.definiteSingular,
          }),
        },
      }) as const,
    [copy.location.definiteSingular, t],
  );

  const openInfo = (key: typeof infoKey) => {
    setInfoKey(key);
    setInfoOpen(true);
  };

  const availableCopyLocations = useMemo(
    () => locations.filter((loc) => loc.id !== currentLocationId),
    [locations, currentLocationId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedListQuery(listQuery.trim());
    }, LIST_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [listQuery]);

  const configQuery = useQuery({
    queryKey: queryKeys.adminReferralConfig(currentLocationId),
    queryFn: getReferralConfig,
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId),
    queryFn: () => fetchServicesCached({ localId: currentLocationId }),
  });
  const overviewQuery = useQuery<ReferralOverview>({
    queryKey: queryKeys.adminReferralOverview(currentLocationId),
    queryFn: () => getReferralOverview() as Promise<ReferralOverview>,
  });
  const listQueryResult = useQuery({
    queryKey: queryKeys.adminReferralList(
      currentLocationId,
      listStatus,
      debouncedListQuery,
      LIST_PAGE,
      LIST_PAGE_SIZE,
    ),
    queryFn: () =>
      getReferralList({
        status: listStatus === 'all' ? undefined : listStatus,
        q: debouncedListQuery || undefined,
        page: LIST_PAGE,
        pageSize: LIST_PAGE_SIZE,
      }),
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setConfig(configQuery.data);
  }, [configQuery.data]);

  useEffect(() => {
    if (!configQuery.error && !servicesQuery.error && !overviewQuery.error) return;
    toast({
      title: t('admin.referrals.toast.loadErrorTitle'),
      description: t('admin.referrals.toast.tryLater'),
      variant: 'destructive',
    });
  }, [configQuery.error, overviewQuery.error, servicesQuery.error, t, toast]);

  useEffect(() => {
    if (!listQueryResult.error) return;
    toast({
      title: t('admin.referrals.toast.loadListErrorTitle'),
      description: t('admin.referrals.toast.tryLater'),
      variant: 'destructive',
    });
  }, [listQueryResult.error, t, toast]);

  const services = servicesQuery.data ?? EMPTY_SERVICES;
  const overview = overviewQuery.data ?? null;
  const list = listQueryResult.data ?? EMPTY_REFERRAL_LIST;
  const isLoading = configQuery.isLoading || servicesQuery.isLoading || overviewQuery.isLoading || !config;

  const updateConfigField = <K extends keyof ReferralProgramConfig>(key: K, value: ReferralProgramConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const toggleAllowedService = (serviceId: string) => {
    if (!config) return;
    const current = new Set(config.allowedServiceIds ?? []);
    if (current.has(serviceId)) current.delete(serviceId);
    else current.add(serviceId);
    updateConfigField('allowedServiceIds', Array.from(current));
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const updated = await updateReferralConfig(config);
      setConfig(updated);
      queryClient.setQueryData(queryKeys.adminReferralConfig(currentLocationId), updated);
      toast({
        title: t('admin.referrals.toast.savedTitle'),
        description: t('admin.referrals.toast.savedDescription'),
      });
      await Promise.all([overviewQuery.refetch(), listQueryResult.refetch()]);
    } catch (error) {
      toast({
        title: t('admin.referrals.toast.saveErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.referrals.toast.reviewData'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedCopyLocation) return;
    try {
      const updated = await copyReferralConfig(selectedCopyLocation);
      setConfig(updated);
      queryClient.setQueryData(queryKeys.adminReferralConfig(currentLocationId), updated);
      toast({
        title: t('admin.referrals.toast.copiedTitle'),
        description: t('admin.referrals.toast.copiedDescription', {
          locationFromWithDefinite: copy.location.fromWithDefinite,
        }),
      });
      setCopyDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.referrals.toast.copyErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.referrals.toast.tryLater'),
        variant: 'destructive',
      });
    }
  };


  if (isLoading || !config) {
    return <div className="text-muted-foreground">{t('admin.referrals.loading')}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div  className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">{t('admin.referrals.title')}</h1>
          <p className="text-muted-foreground">
            {t('admin.referrals.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCopyDialogOpen(true)}>
            <Copy className="w-4 h-4" />
            {t('admin.referrals.actions.copyConfig')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="config">{t('admin.referrals.tabs.config')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('admin.referrals.tabs.analytics')}</TabsTrigger>
          <TabsTrigger value="list">{t('admin.referrals.tabs.list')}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                {t('admin.referrals.configTitle', { locationFromWithDefinite: copy.location.fromWithDefinite })}
              </CardTitle>
              <CardDescription>
                {t('admin.referrals.configDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('admin.referrals.fields.enableProgram')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.referrals.fields.enableProgramHint', {
                      locationDefiniteSingular: copy.location.definiteSingular,
                    })}
                  </p>
                </div>
                <Switch checked={config.enabled} onCheckedChange={(val) => updateConfigField('enabled', val)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('admin.referrals.fields.attributionExpiryDays')}</Label>
                    <button
                      type="button"
                      onClick={() => openInfo('expiry')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label={t('admin.referrals.aria.expiryInfo')}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={config.attributionExpiryDays}
                    onChange={(e) => updateConfigField('attributionExpiryDays', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('admin.referrals.fields.monthlyLimit')}</Label>
                    <button
                      type="button"
                      onClick={() => openInfo('monthlyLimit')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label={t('admin.referrals.aria.monthlyLimitInfo')}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={config.monthlyMaxRewardsPerReferrer ?? ''}
                    onChange={(e) =>
                      updateConfigField('monthlyMaxRewardsPerReferrer', e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('admin.referrals.fields.newCustomerOnly')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.referrals.fields.newCustomerOnlyHint', {
                        locationDefiniteSingular: copy.location.definiteSingular,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInfo('newCustomer')}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t('admin.referrals.aria.newCustomerInfo')}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <Switch checked={config.newCustomerOnly} onCheckedChange={(val) => updateConfigField('newCustomerOnly', val)} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>{t('admin.referrals.fields.allowedServices')}</Label>
                  <button
                    type="button"
                    onClick={() => openInfo('allowedServices')}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t('admin.referrals.aria.allowedServicesInfo')}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={(config.allowedServiceIds ?? []).includes(service.id)}
                        onCheckedChange={() => toggleAllowedService(service.id)}
                      />
                      <span>{service.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t('admin.referrals.reward.referrer.title')}</p>
                      <p className="text-xs text-muted-foreground">{t('admin.referrals.reward.referrer.subtitle')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfo('rewardReferrer')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label={t('admin.referrals.aria.rewardReferrerInfo')}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('admin.referrals.fields.type')}</Label>
                    <Select
                      value={config.rewardReferrerType}
                      onValueChange={(val) =>
                        updateConfigField('rewardReferrerType', val as RewardType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rewardTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {config.rewardReferrerType !== 'FREE_SERVICE' && (
                    <div className="space-y-2">
                      <Label>{t('admin.referrals.fields.value')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={config.rewardReferrerValue ?? ''}
                        onChange={(e) =>
                          updateConfigField('rewardReferrerValue', e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </div>
                  )}
                  {config.rewardReferrerType === 'FREE_SERVICE' && (
                    <div className="space-y-2">
                      <Label>{t('admin.common.table.service')}</Label>
                      <Select
                        value={config.rewardReferrerServiceId ?? ''}
                        onValueChange={(val) => updateConfigField('rewardReferrerServiceId', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('admin.referrals.fields.selectService')} />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t('admin.referrals.reward.referred.title')}</p>
                      <p className="text-xs text-muted-foreground">{t('admin.referrals.reward.referred.subtitle')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfo('rewardReferred')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label={t('admin.referrals.aria.rewardReferredInfo')}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('admin.referrals.fields.type')}</Label>
                    <Select
                      value={config.rewardReferredType}
                      onValueChange={(val) =>
                        updateConfigField('rewardReferredType', val as RewardType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rewardTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {config.rewardReferredType !== 'FREE_SERVICE' && (
                    <div className="space-y-2">
                      <Label>{t('admin.referrals.fields.value')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={config.rewardReferredValue ?? ''}
                        onChange={(e) =>
                          updateConfigField('rewardReferredValue', e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </div>
                  )}
                  {config.rewardReferredType === 'FREE_SERVICE' && (
                    <div className="space-y-2">
                      <Label>{t('admin.common.table.service')}</Label>
                      <Select
                        value={config.rewardReferredServiceId ?? ''}
                        onValueChange={(val) => updateConfigField('rewardReferredServiceId', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('admin.referrals.fields.selectService')} />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{t('admin.referrals.antiFraud.title')}</p>
                  <button
                    type="button"
                    onClick={() => openInfo('antiFraud')}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label={t('admin.referrals.aria.antiFraudInfo')}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('admin.referrals.antiFraud.blockSelfByUser')}</span>
                  <Switch
                    checked={config.antiFraud.blockSelfByUser}
                    onCheckedChange={(val) => updateConfigField('antiFraud', { ...config.antiFraud, blockSelfByUser: val })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('admin.referrals.antiFraud.blockSelfByContact')}</span>
                  <Switch
                    checked={config.antiFraud.blockSelfByContact}
                    onCheckedChange={(val) => updateConfigField('antiFraud', { ...config.antiFraud, blockSelfByContact: val })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('admin.referrals.antiFraud.blockDuplicateContact')}</span>
                  <Switch
                    checked={config.antiFraud.blockDuplicateContact}
                    onCheckedChange={(val) => updateConfigField('antiFraud', { ...config.antiFraud, blockDuplicateContact: val })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="glow" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? t('admin.common.saving') : t('admin.referrals.actions.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t('admin.referrals.metrics.invites'), value: overview?.invites ?? 0, icon: Users },
              { label: t('admin.referrals.metrics.pending'), value: overview?.pending ?? 0, icon: TrendingUp },
              { label: t('admin.referrals.metrics.confirmed'), value: overview?.confirmed ?? 0, icon: Award },
              {
                label: t('admin.referrals.metrics.attributableRevenue'),
                value: `${(overview?.revenueAttributable ?? 0).toFixed(2)}€`,
                icon: TrendingUp,
              },
            ].map((item) => (
              <Card key={item.label} variant="glass">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card variant="elevated">
            <CardHeader>
              <CardTitle>{t('admin.referrals.topAmbassadorsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(overview?.topAmbassadors ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.referrals.topAmbassadorsEmpty')}</p>
              ) : (
                overview.topAmbassadors.map((item) => (
                  <div key={item.userId} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.email}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{item.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>{t('admin.referrals.listTitle')}</CardTitle>
              <CardDescription>{t('admin.referrals.listDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  placeholder={t('admin.referrals.listSearchPlaceholder')}
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
                <Select value={listStatus} onValueChange={setListStatus}>
                  <SelectTrigger className="md:w-64">
                    <SelectValue placeholder={t('admin.referrals.listStatus.allStatuses')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.referrals.listStatus.all')}</SelectItem>
                    <SelectItem value="ATTRIBUTED">{t('admin.referrals.listStatus.attributed')}</SelectItem>
                    <SelectItem value="BOOKED">{t('admin.referrals.listStatus.booked')}</SelectItem>
                    <SelectItem value="COMPLETED">{t('admin.referrals.listStatus.completed')}</SelectItem>
                    <SelectItem value="REWARDED">{t('admin.referrals.listStatus.rewarded')}</SelectItem>
                    <SelectItem value="EXPIRED">{t('admin.referrals.listStatus.expired')}</SelectItem>
                    <SelectItem value="VOIDED">{t('admin.referrals.listStatus.voided')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {list.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.search.empty.title')}</p>
                ) : (
                  list.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.referred?.name || item.referred?.email || item.referred?.phone || t('admin.common.guest')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('admin.referrals.referredBy', { name: item.referrer?.name ?? '-' })}
                          </p>
                        </div>
                        <span className="text-xs uppercase text-muted-foreground">{item.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.referrals.copyDialog.title', {
                locationIndefiniteSingular: copy.location.indefiniteSingular,
              })}
            </DialogTitle>
            <DialogDescription>
              {t('admin.referrals.copyDialog.description', {
                locationDefiniteSingular: copy.location.definiteSingular,
              })}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedCopyLocation} onValueChange={setSelectedCopyLocation}>
            <SelectTrigger>
              <SelectValue
                placeholder={t('admin.referrals.copyDialog.selectPlaceholder', {
                  locationIndefiniteSingular: copy.location.indefiniteSingular,
                })}
              />
            </SelectTrigger>
            <SelectContent>
              {availableCopyLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              {t('appointmentEditor.cancel')}
            </Button>
            <Button onClick={handleCopy} disabled={!selectedCopyLocation}>
              {t('admin.referrals.actions.copyNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoKey ? infoContent[infoKey].title : t('admin.alerts.type.info')}</DialogTitle>
            <DialogDescription>{infoKey ? infoContent[infoKey].body : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInfoOpen(false)}>{t('admin.referrals.actions.understood')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReferrals;
