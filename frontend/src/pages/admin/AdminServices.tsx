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
} from '@/data/api';
import { Service, ServiceCategory, SiteSettings } from '@/data/types';
import { Plus, Pencil, Trash2, Scissors, Clock, Loader2, FolderTree, CheckCircle2, Sparkles, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CardSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { Switch } from '@/components/ui/switch';
import { dispatchServicesUpdated } from '@/lib/adminEvents';

const UNCATEGORIZED_VALUE = 'none';

const AdminServices: React.FC = () => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCategoryDeleteDialogOpen, setIsCategoryDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
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
  const categoriesEnabled = settings?.services.categoriesEnabled ?? false;

  const loadData = async (withLoader = true) => {
    if (withLoader) setIsLoading(true);
    try {
      const [servicesData, categoriesData, settingsData] = await Promise.all([
        getServices(),
        getServiceCategories(true),
        getSiteSettings(),
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
      setSettings(settingsData);
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
      dispatchServicesUpdated({ source: 'admin-services' });
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
      dispatchServicesUpdated({ source: 'admin-services' });
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la categoría.', variant: 'destructive' });
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingServiceId) return;
    
    try {
      await deleteService(deletingServiceId);
      toast({ title: 'Servicio eliminado', description: 'El servicio ha sido eliminado.' });
      await loadData(false);
      dispatchServicesUpdated({ source: 'admin-services' });
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
      dispatchServicesUpdated({ source: 'admin-services' });
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
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la categoría.', variant: 'destructive' });
    } finally {
      setUpdatingServiceCategoryId(null);
    }
  };

  const handleToggleCategories = async (enabled: boolean) => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const updated = await updateSiteSettings({
        ...settings,
        services: { categoriesEnabled: enabled },
      });
      setSettings(updated);
      dispatchServicesUpdated({ source: 'admin-services' });
      const pendingNotice = enabled && uncategorizedServices.length > 0
        ? `Tienes ${uncategorizedServices.length} servicio(s) sin categoría. Asignalos para completar la vista.`
        : '';
      toast({
        title: enabled ? 'Categorización activada' : 'Categorización desactivada',
        description: enabled
          ? `Los clientes verán los servicios agrupados por categoría.${pendingNotice ? ` ${pendingNotice}` : ''}`
          : 'Los servicios se mostrarán en lista simple.',
      });
      if (enabled && uncategorizedServices.length > 0) {
        toast({
          title: 'Asigna las categorías pendientes',
          description: 'Puedes crear categorías y asignarlas a los servicios sin categoría.',
        });
      }
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
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Servicios</h1>
          <p className="text-muted-foreground mt-1">
            Diseña la carta de servicios y cómo se presentan a los clientes.
          </p>
        </div>
        <div className="flex gap-2">
          {categoriesEnabled && (
            <Button variant="outline" onClick={() => openCategoryDialog()}>
              <FolderTree className="w-4 h-4 mr-2" />
              Nueva categoría
            </Button>
          )}
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
            {categoriesEnabled && (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Categorización activa
                  </div>
                  <p className="mt-2">
                    Asegúrate de que todos los servicios tengan categoría asignada para una experiencia limpia.
                  </p>
                </div>
                {uncategorizedServices.length > 0 && (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                    Tienes {uncategorizedServices.length} servicio(s) sin categoría. Asígnalos para activar la vista agrupada.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        {categoriesEnabled && (
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
        )}
      </div>

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
                {categoriesEnabled && (
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
                        {orderedCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {updatingServiceCategoryId === service.id && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                  </div>
                )}
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
              {categoriesEnabled && (
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderedCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {orderedCategories.length === 0 && (
                    <p className="text-xs text-destructive">Crea una categoría antes de añadir servicios.</p>
                  )}
                </div>
              )}
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

    </div>
  );
};

export default AdminServices;
