import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { SiteSettings } from '@/data/types';
import { getServices, getSiteSettings, updateSiteSettings } from '@/data/api';
import { useToast } from '@/hooks/use-toast';
import { composePhone, normalizePhoneParts } from '@/lib/siteSettings';
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
} from 'lucide-react';

const DAY_LABELS: { key: keyof SiteSettings['openingHours']; label: string }[] = [
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

const cloneSettings = (data: SiteSettings): SiteSettings => JSON.parse(JSON.stringify(data));

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
  const [settings, setSettings] = useState<SiteSettings>(() => cloneSettings(DEFAULT_SITE_SETTINGS));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [{ prefix: phonePrefix, number: phoneNumber }, setPhoneParts] = useState(() =>
    normalizePhoneParts(DEFAULT_SITE_SETTINGS.contact.phone)
  );

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await getSiteSettings();
      setSettings(data);
      setPhoneParts(normalizePhoneParts(data.contact.phone));
    } catch (error) {
      toast({
        title: 'No se pudo cargar la configuración',
        description: 'Intenta de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (fromSchedule = false) => {
    fromSchedule ? setIsSavingSchedule(true) : setIsSaving(true);
    try {
      const phone = composePhone(phonePrefix, phoneNumber);
      const payload: SiteSettings = {
        ...settings,
        contact: { ...settings.contact, phone },
        socials: { ...settings.socials },
      };
      Object.entries(payload.socials).forEach(([key, value]) => {
        payload.socials[key as keyof SiteSettings['socials']] = value?.trim() || '';
      });

      if (payload.services.categoriesEnabled) {
        const servicesData = await getServices();
        const missingCategory = servicesData.filter((service) => !service.categoryId);
        if (missingCategory.length > 0) {
          toast({
            title: 'No se pudo guardar',
            description: 'Asigna una categoría a todos los servicios o desactiva la categorización.',
            variant: 'destructive',
          });
          return;
        }
      }

      const updated = await updateSiteSettings(payload);
      setSettings(updated);
      setPhoneParts(normalizePhoneParts(updated.contact.phone));
      window.dispatchEvent(new CustomEvent('site-settings-updated', { detail: updated }));
      toast({
        title: 'Configuración actualizada',
        description: fromSchedule ? 'Horario guardado.' : 'Los cambios se han guardado correctamente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Revisa los campos e intenta nuevamente.';
      toast({
        title: 'Error al guardar',
        description: message,
        variant: 'destructive',
      });
    } finally {
      fromSchedule ? setIsSavingSchedule(false) : setIsSaving(false);
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

  const handleStatsChange = (field: keyof SiteSettings['stats'], value: number) => {
    setSettings((prev) => ({
      ...prev,
      stats: { ...prev.stats, [field]: value },
    }));
  };

  const handleShiftTimeChange = (
    day: keyof SiteSettings['openingHours'],
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
    day: keyof SiteSettings['openingHours'],
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

  const handleScheduleClosed = (day: keyof SiteSettings['openingHours'], closed: boolean) => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración general</h1>
          <p className="text-muted-foreground mt-1">
            Ajusta los datos públicos del sitio, las estadísticas destacadas y el horario de apertura.
          </p>
        </div>
        <Button onClick={() => handleSave(false)} disabled={isSaving || isSavingSchedule || isLoading}>
          {(isSaving || isLoading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Settings className="w-4 h-4 mr-2" />
          Guardar cambios
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando configuración...
        </div>
      )}

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
                <Label>Nombre del salón</Label>
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
            <div className="grid sm:grid-cols-2 gap-4">
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
                    value={phonePrefix}
                    onChange={(e) => setPhoneParts((prev) => ({ ...prev, prefix: e.target.value }))}
                    placeholder="+34"
                    disabled={isLoading}
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
              <Label>Año de inicio</Label>
              <Input
                type="number"
                value={settings.stats.experienceStartYear}
                onChange={(e) => handleStatsChange('experienceStartYear', parseInt(e.target.value, 10) || settings.stats.experienceStartYear)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Experiencia: <span className="text-foreground font-medium">{experienceYears} años</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Valoración media</Label>
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
              <Label>Reservas / año</Label>
              <Input
                type="number"
                min={0}
                value={settings.stats.yearlyBookings}
                onChange={(e) => handleStatsChange('yearlyBookings', parseInt(e.target.value, 10) || 0)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>% clientes que repiten</Label>
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
            {[
              { icon: Sparkles, label: 'Años de experiencia', value: `${experienceYears}+` },
              { icon: Star, label: 'Valoración media', value: settings.stats.averageRating.toFixed(1) },
              { icon: Calendar, label: 'Reservas/año', value: settings.stats.yearlyBookings.toLocaleString('es-ES') },
              { icon: Repeat, label: 'Clientes que repiten', value: `${settings.stats.repeatClientsPercentage}%` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/80 bg-muted/40 px-3 py-3 flex items-center gap-3"
              >
                <stat.icon className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold text-foreground leading-tight">{stat.value}</p>
                </div>
              </div>
            ))}
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
              Este horario se muestra en la web y es independiente de la disponibilidad de barberos.
            </p>
          </div>
          <Button onClick={() => handleSave(true)} disabled={isSavingSchedule || isSaving || isLoading}>
            {isSavingSchedule && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar horario
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
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
    </div>
  );
};

export default AdminSettings;
