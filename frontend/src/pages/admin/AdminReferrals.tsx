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

const rewardTypeOptions = [
  { value: 'WALLET', label: 'Saldo (wallet)' },
  { value: 'PERCENT_DISCOUNT', label: '% Descuento' },
  { value: 'FIXED_DISCOUNT', label: 'Descuento fijo' },
  { value: 'FREE_SERVICE', label: 'Servicio gratis' },
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

  const infoContent = {
    expiry: {
      title: 'Caducidad de la atribución',
      body: 'Es el número de días que tiene un invitado desde que entra por tu enlace para completar su primera cita. Si se pasa el plazo, la invitación expira y no genera recompensa.',
    },
    newCustomer: {
      title: 'Solo nuevos clientes',
      body: `Cuando está activo, el referido solo es válido si el invitado no tiene citas previas en ${copy.location.definiteSingular}.`,
    },
    monthlyLimit: {
      title: 'Límite mensual por embajador',
      body: 'Define cuántas recompensas puede desbloquear un mismo embajador en un mes. Si se supera, las nuevas invitaciones quedan invalidadas.',
    },
    allowedServices: {
      title: 'Servicios permitidos',
      body: 'Si seleccionas servicios aquí, solo las citas de esos servicios podrán activar la recompensa del referido.',
    },
    rewardReferrer: {
      title: 'Recompensa embajador',
      body: 'Lo que gana el cliente que invita. Puedes dar saldo, descuento o un servicio gratis.',
    },
    rewardReferred: {
      title: 'Recompensa invitado',
      body: 'Lo que gana la persona invitada cuando completa su primera cita.',
    },
    antiFraud: {
      title: 'Anti-fraude',
      body: `Bloquear auto-referidos por usuario: impide que alguien se refiera a sí mismo con su propia cuenta. Bloquear auto-referidos por contacto: evita que el invitado use el mismo email o teléfono que el embajador. Bloquear contactos duplicados: una misma identidad (email/teléfono) no puede generar más de una recompensa en ${copy.location.definiteSingular}.`,
    },
  } as const;

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
      title: 'No se pudo cargar referidos',
      description: 'Inténtalo más tarde.',
      variant: 'destructive',
    });
  }, [configQuery.error, overviewQuery.error, servicesQuery.error, toast]);

  useEffect(() => {
    if (!listQueryResult.error) return;
    toast({
      title: 'No se pudo cargar el listado',
      description: 'Inténtalo más tarde.',
      variant: 'destructive',
    });
  }, [listQueryResult.error, toast]);

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
        title: 'Configuración guardada',
        description: 'Programa de referidos actualizado.',
      });
      await Promise.all([overviewQuery.refetch(), listQueryResult.refetch()]);
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Revisa los datos.',
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
      toast({ title: 'Configuración copiada', description: `Se aplicó la configuración ${copy.location.fromWithDefinite}.` });
      setCopyDialogOpen(false);
    } catch (error) {
      toast({
        title: 'No se pudo copiar',
        description: error instanceof Error ? error.message : 'Inténtalo más tarde.',
        variant: 'destructive',
      });
    }
  };


  if (isLoading || !config) {
    return <div className="text-muted-foreground">Cargando referidos...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div  className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Programa de referidos</h1>
          <p className="text-muted-foreground">
            Convierte a tus clientes en tu mejor canal de crecimiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCopyDialogOpen(true)}>
            <Copy className="w-4 h-4" />
            Copiar configuración
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="analytics">Analítica</TabsTrigger>
          <TabsTrigger value="list">Listado</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Configuración {copy.location.fromWithDefinite}
              </CardTitle>
              <CardDescription>
                Ajusta reglas, recompensas y anti-fraude.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Activar programa</p>
                  <p className="text-xs text-muted-foreground">
                    Habilita el programa de referidos en {copy.location.definiteSingular}.
                  </p>
                </div>
                <Switch checked={config.enabled} onCheckedChange={(val) => updateConfigField('enabled', val)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Caducidad atribución (días)</Label>
                    <button
                      type="button"
                      onClick={() => openInfo('expiry')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Información sobre caducidad"
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
                    <Label>Límite mensual por embajador</Label>
                    <button
                      type="button"
                      onClick={() => openInfo('monthlyLimit')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Información sobre límite mensual"
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
                    <p className="text-sm font-medium text-foreground">Solo nuevos clientes</p>
                    <p className="text-xs text-muted-foreground">
                      Solo cuenta la primera cita en {copy.location.definiteSingular}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInfo('newCustomer')}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Información sobre solo nuevos clientes"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <Switch checked={config.newCustomerOnly} onCheckedChange={(val) => updateConfigField('newCustomerOnly', val)} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Servicios permitidos (opcional)</Label>
                  <button
                    type="button"
                    onClick={() => openInfo('allowedServices')}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Información sobre servicios permitidos"
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
                      <p className="text-sm font-semibold text-foreground">Recompensa embajador</p>
                      <p className="text-xs text-muted-foreground">Lo que gana quien invita.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfo('rewardReferrer')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Información sobre recompensa embajador"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
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
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {config.rewardReferrerType !== 'FREE_SERVICE' && (
                    <div className="space-y-2">
                      <Label>Valor</Label>
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
                      <Label>Servicio</Label>
                      <Select
                        value={config.rewardReferrerServiceId ?? ''}
                        onValueChange={(val) => updateConfigField('rewardReferrerServiceId', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona servicio" />
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
                      <p className="text-sm font-semibold text-foreground">Recompensa invitado</p>
                      <p className="text-xs text-muted-foreground">Lo que gana la persona invitada.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfo('rewardReferred')}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Información sobre recompensa invitado"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
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
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {config.rewardReferredType !== 'FREE_SERVICE' && (
                    <div className="space-y-2">
                      <Label>Valor</Label>
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
                      <Label>Servicio</Label>
                      <Select
                        value={config.rewardReferredServiceId ?? ''}
                        onValueChange={(val) => updateConfigField('rewardReferredServiceId', val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona servicio" />
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
                  <p className="text-sm font-semibold text-foreground">Anti-fraude</p>
                  <button
                    type="button"
                    onClick={() => openInfo('antiFraud')}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Información sobre anti-fraude"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bloquear auto-referidos por usuario</span>
                  <Switch
                    checked={config.antiFraud.blockSelfByUser}
                    onCheckedChange={(val) => updateConfigField('antiFraud', { ...config.antiFraud, blockSelfByUser: val })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bloquear auto-referidos por contacto</span>
                  <Switch
                    checked={config.antiFraud.blockSelfByContact}
                    onCheckedChange={(val) => updateConfigField('antiFraud', { ...config.antiFraud, blockSelfByContact: val })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bloquear contactos duplicados</span>
                  <Switch
                    checked={config.antiFraud.blockDuplicateContact}
                    onCheckedChange={(val) => updateConfigField('antiFraud', { ...config.antiFraud, blockDuplicateContact: val })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="glow" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Invitaciones', value: overview?.invites ?? 0, icon: Users },
              { label: 'Pendientes', value: overview?.pending ?? 0, icon: TrendingUp },
              { label: 'Confirmados', value: overview?.confirmed ?? 0, icon: Award },
              { label: 'Revenue atribuible', value: `${(overview?.revenueAttributable ?? 0).toFixed(2)}€`, icon: TrendingUp },
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
              <CardTitle>Top embajadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(overview?.topAmbassadors ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay embajadores destacados.</p>
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
              <CardTitle>Listado de referidos</CardTitle>
              <CardDescription>Filtra por estado o busca por nombre/contacto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  placeholder="Buscar por nombre, email o teléfono"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
                <Select value={listStatus} onValueChange={setListStatus}>
                  <SelectTrigger className="md:w-64">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ATTRIBUTED">Pendiente</SelectItem>
                    <SelectItem value="BOOKED">Reservado</SelectItem>
                    <SelectItem value="COMPLETED">Completado</SelectItem>
                    <SelectItem value="REWARDED">Recompensado</SelectItem>
                    <SelectItem value="EXPIRED">Expirado</SelectItem>
                    <SelectItem value="VOIDED">Invalidado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {list.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay resultados.</p>
                ) : (
                  list.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.referred?.name || item.referred?.email || item.referred?.phone || 'Invitado'}
                          </p>
                          <p className="text-xs text-muted-foreground">Invitado por {item.referrer?.name}</p>
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
            <DialogTitle>Copiar configuración desde {copy.location.indefiniteSingular}</DialogTitle>
            <DialogDescription>
              Selecciona {copy.location.definiteSingular} origen para copiar su configuración.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedCopyLocation} onValueChange={setSelectedCopyLocation}>
            <SelectTrigger>
              <SelectValue placeholder={`Selecciona ${copy.location.indefiniteSingular}`} />
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
              Cancelar
            </Button>
            <Button onClick={handleCopy} disabled={!selectedCopyLocation}>
              Copiar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoKey ? infoContent[infoKey].title : 'Información'}</DialogTitle>
            <DialogDescription>{infoKey ? infoContent[infoKey].body : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInfoOpen(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReferrals;
