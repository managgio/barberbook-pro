import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  getServices,
  createService,
  updateService,
  deleteService,
  getServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  getSiteSettings,
  updateSiteSettings,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} from '@/data/api';
import { Offer, OfferScope, Service, ServiceCategory, SiteSettings } from '@/data/types';
import { Plus, Pencil, Trash2, Scissors, Clock, Loader2, FolderTree, CheckCircle2, Sparkles, Percent, Euro } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CardSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

const UNCATEGORIZED_VALUE = 'none';

const AdminServices: React.FC = () => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCategoryDeleteDialogOpen, setIsCategoryDeleteDialogOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [isOfferDeleteDialogOpen, setIsOfferDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isOfferSubmitting, setIsOfferSubmitting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [updatingServiceCategoryId, setUpdatingServiceCategoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    categoryId: UNCATEGORIZED_VALUE,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    position: 0,
  });
  const [offerForm, setOfferForm] = useState({
    name: '',
    description: '',
    discountType: 'percentage' as Offer['discountType'],
    discountValue: '',
    scope: 'all' as OfferScope,
    categoryIds: [] as string[],
    serviceIds: [] as string[],
    startDate: '',
    endDate: '',
    active: true,
  });

  const categoriesEnabled = settings?.services.categoriesEnabled ?? false;

  const loadData = async (withLoader = true) => {
    if (withLoader) setIsLoading(true);
    try {
      const [servicesData, categoriesData, settingsData, offersData] = await Promise.all([
        getServices(),
        getServiceCategories(true),
        getSiteSettings(),
        getOffers(),
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
      setSettings(settingsData);
      setOffers(offersData);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar la configuración de servicios.', variant: 'destructive' });
    } finally {
      if (withLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const orderedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [categories],
  );
  const uncategorizedServices = useMemo(
    () => services.filter((service) => !service.categoryId),
    [services],
  );

  const getPriceDisplay = (service: Service) => {
    const finalPrice = service.finalPrice ?? service.price;
    const hasOffer = !!service.appliedOffer && Math.abs(finalPrice - service.price) > 0.001;
    return { finalPrice, hasOffer };
  };

  const openCreateDialog = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      duration: '',
      categoryId: categoriesEnabled ? orderedCategories[0]?.id ?? UNCATEGORIZED_VALUE : UNCATEGORIZED_VALUE,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      duration: service.duration.toString(),
      categoryId: service.categoryId || UNCATEGORIZED_VALUE,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingServiceId(id);
    setIsDeleteDialogOpen(true);
  };

  const openCategoryDialog = (category?: ServiceCategory) => {
    setEditingCategory(category || null);
    setCategoryForm({
      name: category?.name || '',
      description: category?.description || '',
      position: category?.position ?? categories.length,
    });
    setIsCategoryDialogOpen(true);
  };

  const openOfferDialog = (offer?: Offer) => {
    setEditingOffer(offer || null);
    setOfferForm({
      name: offer?.name || '',
      description: offer?.description || '',
      discountType: offer?.discountType || 'percentage',
      discountValue: offer ? String(offer.discountValue) : '',
      scope: offer?.scope || 'all',
      categoryIds: offer?.categories?.map((c) => c.id) || [],
      serviceIds: offer?.services?.map((s) => s.id) || [],
      startDate: offer?.startDate ? offer.startDate.slice(0, 10) : '',
      endDate: offer?.endDate ? offer.endDate.slice(0, 10) : '',
      active: offer?.active ?? true,
    });
    setIsOfferDialogOpen(true);
  };

  const openOfferDeleteDialog = (id: string) => {
    setDeletingOfferId(id);
    setIsOfferDeleteDialogOpen(true);
  };

  const openCategoryDeleteDialog = (id: string) => {
    setDeletingCategoryId(id);
    setIsCategoryDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsedDuration = parseInt(formData.duration, 10);
      const parsedPrice = parseFloat(formData.price);
      const categoryId = formData.categoryId === UNCATEGORIZED_VALUE ? null : formData.categoryId;

      if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        toast({ title: 'Duración inválida', description: 'Define la duración en minutos.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        toast({ title: 'Precio inválido', description: 'Introduce un precio válido.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      if (categoriesEnabled && !categoryId) {
        toast({
          title: 'Falta la categoría',
          description: 'Activa una categoría antes de guardar el servicio.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (editingService) {
        await updateService(editingService.id, {
          name: formData.name,
          description: formData.description,
          price: parsedPrice,
          duration: parsedDuration,
          categoryId,
        });
        toast({ title: 'Servicio actualizado', description: 'Los cambios han sido guardados.' });
      } else {
        await createService({
          name: formData.name,
          description: formData.description,
          price: parsedPrice,
          duration: parsedDuration,
          categoryId,
        });
        toast({ title: 'Servicio creado', description: 'El nuevo servicio ha sido añadido.' });
      }
      
      await loadData(false);
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el servicio.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCategorySubmitting(true);
    try {
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        position: Number(categoryForm.position) || 0,
      };
      if (editingCategory) {
        await updateServiceCategory(editingCategory.id, payload);
        toast({ title: 'Categoría actualizada', description: 'Los cambios se han guardado.' });
      } else {
        await createServiceCategory(payload);
        toast({ title: 'Categoría creada', description: 'Añade servicios dentro de ella.' });
      }
      await loadData(false);
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la categoría.', variant: 'destructive' });
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOfferSubmitting(true);
    try {
      const discountValue = parseFloat(offerForm.discountValue);
      if (Number.isNaN(discountValue) || discountValue <= 0) {
        toast({ title: 'Valor de oferta inválido', description: 'Introduce un número mayor que cero.', variant: 'destructive' });
        setIsOfferSubmitting(false);
        return;
      }

      const payload = {
        name: offerForm.name,
        description: offerForm.description || undefined,
        discountType: offerForm.discountType,
        discountValue,
        scope: offerForm.scope,
        categoryIds: offerForm.scope === 'categories' ? offerForm.categoryIds : undefined,
        serviceIds: offerForm.scope === 'services' ? offerForm.serviceIds : undefined,
        startDate: offerForm.startDate || undefined,
        endDate: offerForm.endDate || undefined,
        active: offerForm.active,
      };

      if (offerForm.scope === 'categories' && (!payload.categoryIds || payload.categoryIds.length === 0)) {
        toast({ title: 'Selecciona categorías', description: 'Elige al menos una categoría.', variant: 'destructive' });
        setIsOfferSubmitting(false);
        return;
      }

      if (offerForm.scope === 'services' && (!payload.serviceIds || payload.serviceIds.length === 0)) {
        toast({ title: 'Selecciona servicios', description: 'Elige al menos un servicio.', variant: 'destructive' });
        setIsOfferSubmitting(false);
        return;
      }

      if (offerForm.startDate && offerForm.endDate && offerForm.startDate > offerForm.endDate) {
        toast({ title: 'Rango de fechas inválido', description: 'La fecha de inicio debe ser anterior a la fecha fin.', variant: 'destructive' });
        setIsOfferSubmitting(false);
        return;
      }

      if (editingOffer) {
        await updateOffer(editingOffer.id, payload);
        toast({ title: 'Oferta actualizada', description: 'Los cambios se han guardado.' });
      } else {
        await createOffer(payload as any);
        toast({ title: 'Oferta creada', description: 'Ya puedes aplicarla a tus servicios.' });
      }

      await loadData(false);
      setIsOfferDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'No se pudo guardar la oferta.', variant: 'destructive' });
    } finally {
      setIsOfferSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingServiceId) return;
    
    try {
      await deleteService(deletingServiceId);
      toast({ title: 'Servicio eliminado', description: 'El servicio ha sido eliminado.' });
      await loadData(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el servicio.', variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingServiceId(null);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategoryId) return;
    try {
      await deleteServiceCategory(deletingCategoryId);
      toast({ title: 'Categoría eliminada', description: 'Los servicios asociados quedan sin categoría.' });
      await loadData(false);
    } catch (error: any) {
      toast({
        title: 'No se pudo eliminar',
        description:
          error?.message || 'Asegúrate de mover o desactivar la categorización antes de borrar.',
        variant: 'destructive',
      });
    } finally {
      setIsCategoryDeleteDialogOpen(false);
      setDeletingCategoryId(null);
    }
  };

  const handleDeleteOffer = async () => {
    if (!deletingOfferId) return;
    try {
      await deleteOffer(deletingOfferId);
      toast({ title: 'Oferta eliminada', description: 'Se ha retirado correctamente.' });
      await loadData(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'No se pudo eliminar la oferta.', variant: 'destructive' });
    } finally {
      setIsOfferDeleteDialogOpen(false);
      setDeletingOfferId(null);
    }
  };

  const handleAssignCategory = async (service: Service, categoryId: string) => {
    const normalizedCategoryId = categoryId === UNCATEGORIZED_VALUE ? null : categoryId;

    if (categoriesEnabled && !normalizedCategoryId) {
      toast({
        title: 'Falta categoría',
        description: 'Asigna una categoría para mantener la experiencia organizada.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingServiceCategoryId(service.id);
    try {
      await updateService(service.id, { categoryId: normalizedCategoryId });
      await loadData(false);
      toast({ title: 'Servicio actualizado', description: 'Categoría asignada correctamente.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la categoría.', variant: 'destructive' });
    } finally {
      setUpdatingServiceCategoryId(null);
    }
  };

  const handleToggleCategories = async (enabled: boolean) => {
    if (!settings) return;
    if (enabled && uncategorizedServices.length > 0) {
      toast({
        title: 'Asigna las categorías pendientes',
        description: 'Todos los servicios deben tener una categoría antes de activar esta vista.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      const updated = await updateSiteSettings({
        ...settings,
        services: { categoriesEnabled: enabled },
      });
      setSettings(updated);
      toast({
        title: enabled ? 'Categorización activada' : 'Categorización desactivada',
        description: enabled
          ? 'Los clientes verán los servicios agrupados por categoría.'
          : 'Los servicios se mostrarán en lista simple.',
      });
    } catch (error: any) {
      toast({
        title: 'No se pudo actualizar',
        description: error?.message || 'Revisa las categorías antes de continuar.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Servicios</h1>
          <p className="text-muted-foreground mt-1">
            Diseña la carta de servicios y cómo se presentan a los clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCategoryDialog()}>
            <FolderTree className="w-4 h-4 mr-2" />
            Nueva categoría
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div className="grid lg:grid-cols-4 gap-6">
        <Card variant="elevated" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Presentación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium text-sm text-foreground">Agrupar por categorías</p>
                <p className="text-xs text-muted-foreground">
                  Si está activo, los clientes verán servicios ordenados por categoría.
                </p>
              </div>
              <Switch
                checked={categoriesEnabled}
                disabled={!settings || isSavingSettings}
                onCheckedChange={handleToggleCategories}
              />
            </div>
            {categoriesEnabled ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Categorización activa
                </div>
                <p className="mt-2">
                  Asegúrate de que todos los servicios tengan categoría asignada para una experiencia limpia.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                Los clientes verán un listado simple de servicios.
              </div>
            )}
            {uncategorizedServices.length > 0 && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                Tienes {uncategorizedServices.length} servicio(s) sin categoría. Asígnalos para activar la vista agrupada.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card variant="elevated" className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-primary" />
                Categorías
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Agrupa servicios por familias para una navegación más ligera.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : orderedCategories.length > 0 ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {orderedCategories.map((category) => {
                  const count =
                    category.services?.length ??
                    services.filter((service) => service.categoryId === category.id).length;
                  return (
                    <div
                      key={category.id}
                      className="rounded-xl border border-border p-4 bg-background/60 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{category.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {category.description || 'Sin descripción'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCategoryDeleteDialog(category.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{count} servicio(s)</span>
                        <span className="px-2 py-1 rounded-full border border-border">
                          Orden {category.position ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={FolderTree}
                title="Sin categorías aún"
                description="Crea categorías para organizar el catálogo."
                action={{ label: 'Crear categoría', onClick: () => openCategoryDialog() }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offers */}
      <Card variant="elevated">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Ofertas
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Crea descuentos por porcentaje o cantidad y aplícalos a todos, a categorías o a servicios concretos.
            </p>
          </div>
          <Button variant="outline" onClick={() => openOfferDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva oferta
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {offers.length > 0 ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {offers.map((offer) => {
                const isPercent = offer.discountType === 'percentage';
                const scopeLabel =
                  offer.scope === 'all'
                    ? 'Todos los servicios'
                    : offer.scope === 'categories'
                    ? `${offer.categories.length} categoría(s)`
                    : `${offer.services.length} servicio(s)`;
                return (
                  <div key={offer.id} className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{offer.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{offer.description || 'Sin descripción'}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openOfferDialog(offer)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openOfferDeleteDialog(offer.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="gap-1">
                        {isPercent ? <Percent className="w-3 h-3" /> : <Euro className="w-3 h-3" />}
                        {offer.discountValue}{isPercent ? '%' : '€'} de dto.
                      </Badge>
                      <Badge variant={offer.active ? 'secondary' : 'outline'} className="text-[11px]">
                        {offer.active ? 'Activa' : 'Pausada'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-1 rounded-full border border-border">{scopeLabel}</span>
                      {offer.startDate && <span>Inicio: {offer.startDate.slice(0, 10)}</span>}
                      {offer.endDate && <span>Fin: {offer.endDate.slice(0, 10)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Percent}
              title="Sin ofertas"
              description="Crea promociones para impulsar reservas."
              action={{ label: 'Nueva oferta', onClick: () => openOfferDialog() }}
            />
          )}
        </CardContent>
      </Card>

      {/* Services Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : services.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id} variant="elevated" className="h-full">
              <CardContent className="p-6 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Scissors className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(service.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground text-lg">{service.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    {service.duration} min
                  </div>
                  <div className="text-right">
                    {getPriceDisplay(service).hasOffer && (
                      <div className="text-xs line-through text-muted-foreground">{service.price}€</div>
                    )}
                    <span className="text-2xl font-bold text-primary">
                      {getPriceDisplay(service).finalPrice}€
                    </span>
                  </div>
                </div>
                {getPriceDisplay(service).hasOffer && service.appliedOffer && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                    <Percent className="w-3 h-3" />
                    {service.appliedOffer.name} · ahorras {service.appliedOffer.amountOff.toFixed(2)}€
                  </div>
                )}
                <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Categoría</span>
                    {service.category ? (
                      <Badge variant="secondary" className="w-fit">{service.category.name}</Badge>
                    ) : (
                      <Badge variant="outline" className="w-fit">Sin categoría</Badge>
                    )}
                  </div>
                  <Select
                    value={service.categoryId || UNCATEGORIZED_VALUE}
                    onValueChange={(value) => handleAssignCategory(service, value)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Asignar" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {!categoriesEnabled && (
                        <SelectItem value={UNCATEGORIZED_VALUE}>Sin categoría</SelectItem>
                      )}
                      {orderedCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {updatingServiceCategoryId === service.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Scissors}
          title="Sin servicios"
          description="Añade servicios para que los clientes puedan reservar."
          action={{ label: 'Crear servicio', onClick: openCreateDialog }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar servicio' : 'Nuevo servicio'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Corte clásico"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el servicio..."
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio (€)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="18"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="5"
                    step="5"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="30"
                    required
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Define cuánto dura este servicio para calcular los huecos disponibles.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={categoriesEnabled ? 'Selecciona una categoría' : 'Opcional'} />
                  </SelectTrigger>
                  <SelectContent>
                    {!categoriesEnabled && <SelectItem value={UNCATEGORIZED_VALUE}>Sin categoría</SelectItem>}
                    {orderedCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoriesEnabled && orderedCategories.length === 0 && (
                  <p className="text-xs text-destructive">Crea una categoría antes de añadir servicios.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingService ? 'Guardar cambios' : 'Crear servicio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Color, Cortes, Tratamientos..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Descripción</Label>
                <Textarea
                  id="category-description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Texto breve para contextualizar."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-position">Orden</Label>
                <Input
                  id="category-position"
                  type="number"
                  min="0"
                  value={categoryForm.position}
                  onChange={(e) => setCategoryForm({ ...categoryForm, position: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">Controla el orden en el que se muestran.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCategorySubmitting}>
                {isCategorySubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOffer ? 'Editar oferta' : 'Nueva oferta'}</DialogTitle>
            <DialogDescription>
              Define el descuento, alcance y fechas opcionales de activación.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOfferSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={offerForm.name}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Promoción de verano"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción (opcional)</Label>
                  <Input
                    value={offerForm.description}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Explica brevemente el descuento"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={offerForm.discountType}
                    onValueChange={(value) => setOfferForm((prev) => ({ ...prev, discountType: value as Offer['discountType'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de descuento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      <SelectItem value="amount">Cantidad (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={offerForm.discountValue}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                    placeholder={offerForm.discountType === 'percentage' ? '10' : '2'}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ámbito</Label>
                  <Select
                    value={offerForm.scope}
                    onValueChange={(value) => setOfferForm((prev) => ({ ...prev, scope: value as OfferScope }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el ámbito" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los servicios</SelectItem>
                      <SelectItem value="categories" disabled={!categoriesEnabled || orderedCategories.length === 0}>
                        Categorías {categoriesEnabled ? '' : '(activa categorías)'}
                      </SelectItem>
                      <SelectItem value="services">Servicios concretos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {offerForm.scope === 'categories' && (
                <div className="space-y-2">
                  <Label>Categorías a incluir</Label>
                  <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border p-3">
                    {orderedCategories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={offerForm.categoryIds.includes(category.id)}
                          onCheckedChange={(checked) => {
                            setOfferForm((prev) => ({
                              ...prev,
                              categoryIds: checked
                                ? [...prev.categoryIds, category.id]
                                : prev.categoryIds.filter((id) => id !== category.id),
                            }));
                          }}
                        />
                        <span>{category.name}</span>
                      </label>
                    ))}
                  </div>
                  {orderedCategories.length === 0 && (
                    <p className="text-xs text-muted-foreground">Crea al menos una categoría para usar este ámbito.</p>
                  )}
                </div>
              )}

              {offerForm.scope === 'services' && (
                <div className="space-y-2">
                  <Label>Servicios a incluir</Label>
                  <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto rounded-xl border border-border p-3">
                    {services.map((service) => (
                      <label key={service.id} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={offerForm.serviceIds.includes(service.id)}
                          onCheckedChange={(checked) => {
                            setOfferForm((prev) => ({
                              ...prev,
                              serviceIds: checked
                                ? [...prev.serviceIds, service.id]
                                : prev.serviceIds.filter((id) => id !== service.id),
                            }));
                          }}
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                  {services.length === 0 && (
                    <p className="text-xs text-muted-foreground">Crea servicios para poder seleccionarlos.</p>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Inicio</Label>
                  <Input
                    type="date"
                    value={offerForm.startDate}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fin</Label>
                  <Input
                    type="date"
                    value={offerForm.endDate}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                    <Switch
                      checked={offerForm.active}
                      onCheckedChange={(checked) => setOfferForm((prev) => ({ ...prev, active: checked }))}
                    />
                    <span className="text-sm">{offerForm.active ? 'Activa' : 'Pausada'}</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOfferDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isOfferSubmitting}>
                {isOfferSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingOffer ? 'Guardar cambios' : 'Crear oferta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El servicio será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCategoryDeleteDialogOpen} onOpenChange={setIsCategoryDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Las citas no se verán afectadas, pero los servicios asociados quedarán sin categoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isOfferDeleteDialogOpen} onOpenChange={setIsOfferDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar oferta?</AlertDialogTitle>
            <AlertDialogDescription>La promoción dejará de aplicarse de inmediato.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOffer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminServices;
