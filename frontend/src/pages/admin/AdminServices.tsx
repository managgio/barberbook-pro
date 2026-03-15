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
  createServiceCategory,
  deleteServiceCategory,
  updateServiceCategory,
} from '@/data/api/service-categories';
import { createService, deleteService, updateService } from '@/data/api/services';
import { updateSiteSettings } from '@/data/api/settings';
import { Service, ServiceCategory } from '@/data/types';
import { Plus, Pencil, Trash2, Scissors, Clock, Loader2, FolderTree, CheckCircle2, Sparkles, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CardSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { Switch } from '@/components/ui/switch';
import { dispatchServicesUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { fetchServiceCategoriesCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const UNCATEGORIZED_VALUE = 'none';
const EMPTY_SERVICES: Service[] = [];
const EMPTY_SERVICE_CATEGORIES: ServiceCategory[] = [];

const AdminServices: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const { currentLocationId } = useTenant();
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
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId),
    queryFn: () => fetchServicesCached({ localId: currentLocationId }),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.serviceCategories(currentLocationId),
    queryFn: () => fetchServiceCategoriesCached({ localId: currentLocationId }),
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettings(currentLocationId),
    queryFn: () => fetchSiteSettingsCached(currentLocationId),
  });
  const services = useMemo(
    () => servicesQuery.data ?? EMPTY_SERVICES,
    [servicesQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? EMPTY_SERVICE_CATEGORIES,
    [categoriesQuery.data],
  );
  const settings = settingsQuery.data ?? null;
  const isLoading = servicesQuery.isLoading || categoriesQuery.isLoading || settingsQuery.isLoading;
  const categoriesEnabled = settings?.services.categoriesEnabled ?? false;

  useEffect(() => {
    if (!servicesQuery.error && !categoriesQuery.error && !settingsQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.services.toast.loadConfigError'),
      variant: 'destructive',
    });
  }, [categoriesQuery.error, servicesQuery.error, settingsQuery.error, t, toast]);

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
        toast({
          title: t('admin.services.toast.invalidDurationTitle'),
          description: t('admin.services.toast.invalidDurationDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        toast({
          title: t('admin.services.toast.invalidPriceTitle'),
          description: t('admin.services.toast.invalidPriceDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (categoriesEnabled && !categoryId) {
        toast({
          title: t('admin.services.toast.missingCategoryTitle'),
          description: t('admin.services.toast.missingCategoryDescription'),
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
        toast({ title: t('admin.services.toast.serviceUpdatedTitle'), description: t('admin.services.toast.changesSavedDescription') });
      } else {
        await createService({
          name: formData.name,
          description: formData.description,
          price: parsedPrice,
          duration: parsedDuration,
          categoryId,
        });
        toast({ title: t('admin.services.toast.serviceCreatedTitle'), description: t('admin.services.toast.serviceCreatedDescription') });
      }
      
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.saveServiceError'), variant: 'destructive' });
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
        toast({ title: t('admin.services.toast.categoryUpdatedTitle'), description: t('admin.services.toast.changesSavedDescription') });
      } else {
        await createServiceCategory(payload);
        toast({ title: t('admin.services.toast.categoryCreatedTitle'), description: t('admin.services.toast.categoryCreatedDescription') });
      }
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.saveCategoryError'), variant: 'destructive' });
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingServiceId) return;
    
    try {
      await deleteService(deletingServiceId);
      toast({ title: t('admin.services.toast.serviceDeletedTitle'), description: t('admin.services.toast.serviceDeletedDescription') });
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.deleteServiceError'), variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingServiceId(null);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategoryId) return;
    try {
      await deleteServiceCategory(deletingCategoryId);
      toast({ title: t('admin.services.toast.categoryDeletedTitle'), description: t('admin.services.toast.categoryDeletedDescription') });
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({
        title: t('admin.services.toast.deleteErrorTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('admin.services.toast.deleteCategoryHint'),
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
        title: t('admin.services.toast.missingCategoryTitle'),
        description: t('admin.services.toast.assignCategoryDescription'),
        variant: 'destructive',
      });
      return;
    }

    setUpdatingServiceCategoryId(service.id);
    try {
      await updateService(service.id, { categoryId: normalizedCategoryId });
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      toast({ title: t('admin.services.toast.serviceUpdatedTitle'), description: t('admin.services.toast.categoryAssignedDescription') });
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.updateCategoryError'), variant: 'destructive' });
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
        services: {
          ...settings.services,
          categoriesEnabled: enabled,
        },
      });
      dispatchSiteSettingsUpdated(updated);
      dispatchServicesUpdated({ source: 'admin-services' });
      const pendingNotice = enabled && uncategorizedServices.length > 0
        ? t('admin.services.toast.pendingUncategorizedNotice', { count: uncategorizedServices.length })
        : '';
      toast({
        title: enabled ? t('admin.services.toast.categorizationEnabledTitle') : t('admin.services.toast.categorizationDisabledTitle'),
        description: enabled
          ? t('admin.services.toast.categorizationEnabledDescription', {
              pendingNotice: pendingNotice ? ` ${pendingNotice}` : '',
            })
          : t('admin.services.toast.categorizationDisabledDescription'),
      });
      if (enabled && uncategorizedServices.length > 0) {
        toast({
          title: t('admin.services.toast.assignPendingCategoriesTitle'),
          description: t('admin.services.toast.assignPendingCategoriesDescription'),
        });
      }
    } catch (error) {
      toast({
        title: t('admin.services.toast.updateSettingsErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.services.toast.updateSettingsErrorDescription'),
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
          <h1 className="text-3xl font-bold text-foreground">{t('admin.services.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.services.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {categoriesEnabled && (
            <Button variant="outline" onClick={() => openCategoryDialog()}>
              <FolderTree className="w-4 h-4 mr-2" />
              {t('admin.services.actions.newCategory')}
            </Button>
          )}
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            {t('admin.services.actions.newService')}
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div className="grid lg:grid-cols-4 gap-6">
        <Card variant="elevated" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t('admin.services.presentation.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium text-sm text-foreground">{t('admin.services.presentation.groupByCategories')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.services.presentation.groupByCategoriesDescription')}
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
                    {t('admin.services.presentation.categorizationActive')}
                  </div>
                  <p className="mt-2">
                    {t('admin.services.presentation.categorizationActiveDescription')}
                  </p>
                </div>
                {uncategorizedServices.length > 0 && (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                    {t('admin.services.presentation.uncategorizedWarning', { count: uncategorizedServices.length })}
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
                  {t('admin.services.categories.title')}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('admin.services.categories.description')}
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
                              {category.description || t('admin.services.categories.noDescription')}
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
                          <span>{t('admin.services.categories.serviceCount', { count })}</span>
                          <span className="px-2 py-1 rounded-full border border-border">
                            {t('admin.services.categories.order', { position: category.position ?? 0 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={FolderTree}
                  title={t('admin.services.categories.emptyTitle')}
                  description={t('admin.services.categories.emptyDescription')}
                  action={{ label: t('admin.services.actions.createCategory'), onClick: () => openCategoryDialog() }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="mt-2 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : services.length > 0 ? (
        <div className="mt-2 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id} variant="elevated" className="h-full mt-2 sm:mt-0">
              <CardContent className="admin-service-card-content p-6 flex flex-col gap-3">
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
                    {t('appointmentEditor.durationMinutes', { minutes: service.duration })}
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
                    {t('admin.services.offerSavings', {
                      offerName: service.appliedOffer.name,
                      amount: service.appliedOffer.amountOff.toFixed(2),
                    })}
                  </div>
                )}
                {categoriesEnabled && (
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{t('admin.services.fields.category')}</span>
                      {service.category ? (
                        <Badge variant="secondary" className="w-fit">{service.category.name}</Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit">{t('admin.services.uncategorized')}</Badge>
                      )}
                    </div>
                    <Select
                      value={service.categoryId || UNCATEGORIZED_VALUE}
                      onValueChange={(value) => handleAssignCategory(service, value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder={t('admin.services.assignCategory')} />
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
          title={t('admin.services.emptyTitle')}
          description={t('admin.services.emptyDescription')}
          action={{ label: t('admin.services.actions.createService'), onClick: openCreateDialog }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? t('admin.services.dialog.editServiceTitle') : t('admin.services.dialog.newServiceTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.services.dialog.serviceDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="name">{t('admin.services.fields.name')}</Label>
                  <InlineTranslationPopover
                    entityType="service"
                    entityId={editingService?.id}
                    fieldKey="name"
                    onUpdated={async () => {
                      await servicesQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('admin.services.fields.namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="description">{t('admin.services.fields.description')}</Label>
                  <InlineTranslationPopover
                    entityType="service"
                    entityId={editingService?.id}
                    fieldKey="description"
                    onUpdated={async () => {
                      await servicesQuery.refetch();
                    }}
                  />
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('admin.services.fields.descriptionPlaceholder')}
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('admin.services.fields.price')}</Label>
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
                  <Label htmlFor="duration">{t('admin.services.fields.duration')}</Label>
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
                    {t('admin.services.fields.durationHint')}
                  </p>
                </div>
              </div>
              {categoriesEnabled && (
                <div className="space-y-2">
                  <Label>{t('admin.services.fields.category')}</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.services.fields.selectCategory')} />
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
                    <p className="text-xs text-destructive">{t('admin.services.fields.createCategoryFirst')}</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingService ? t('admin.services.actions.saveChanges') : t('admin.services.actions.createService')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? t('admin.services.dialog.editCategoryTitle') : t('admin.services.dialog.newCategoryTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.services.dialog.categoryDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="category-name">{t('admin.services.fields.name')}</Label>
                  <InlineTranslationPopover
                    entityType="service_category"
                    entityId={editingCategory?.id}
                    fieldKey="name"
                    onUpdated={async () => {
                      await categoriesQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder={t('admin.services.dialog.categoryNamePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="category-description">{t('admin.services.fields.description')}</Label>
                  <InlineTranslationPopover
                    entityType="service_category"
                    entityId={editingCategory?.id}
                    fieldKey="description"
                    onUpdated={async () => {
                      await categoriesQuery.refetch();
                    }}
                  />
                </div>
                <Textarea
                  id="category-description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder={t('admin.services.dialog.categoryDescriptionPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-position">{t('admin.services.fields.order')}</Label>
                <Input
                  id="category-position"
                  type="number"
                  min="0"
                  value={categoryForm.position}
                  onChange={(e) => setCategoryForm({ ...categoryForm, position: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">{t('admin.services.fields.orderHint')}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isCategorySubmitting}>
                {isCategorySubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCategory ? t('admin.services.actions.saveChanges') : t('admin.services.actions.createCategory')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.services.deleteServiceDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.services.deleteServiceDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCategoryDeleteDialogOpen} onOpenChange={setIsCategoryDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.services.deleteCategoryDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.services.deleteCategoryDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminServices;
