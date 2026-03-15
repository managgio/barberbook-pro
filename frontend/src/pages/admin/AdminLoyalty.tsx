import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useBusinessCopy } from '@/lib/businessCopy';
import EmptyState from '@/components/common/EmptyState';
import { CardSkeleton } from '@/components/common/Skeleton';
import {
  createLoyaltyProgram,
  deleteLoyaltyProgram,
  getLoyaltyPrograms,
  updateLoyaltyProgram,
} from '@/data/api/loyalty';
import { LoyaltyProgram, LoyaltyScope, Service, ServiceCategory } from '@/data/types';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { fetchServiceCategoriesCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useTenant } from '@/context/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const SCOPE_KEYS: Record<LoyaltyScope, string> = {
  global: 'admin.loyalty.scope.global',
  service: 'admin.loyalty.scope.service',
  category: 'admin.loyalty.scope.category',
};
const EMPTY_PROGRAMS: LoyaltyProgram[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_SERVICE_CATEGORIES: ServiceCategory[] = [];

const AdminLoyalty: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const copy = useBusinessCopy();
  const { currentLocationId } = useTenant();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    scope: 'global' as LoyaltyScope,
    requiredVisits: '10',
    maxCyclesPerClient: '',
    priority: '0',
    isActive: true,
    serviceId: 'none',
    categoryId: 'none',
  });
  const programsQuery = useQuery({
    queryKey: queryKeys.loyaltyPrograms(currentLocationId),
    queryFn: getLoyaltyPrograms,
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId),
    queryFn: () => fetchServicesCached({ localId: currentLocationId }),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.serviceCategories(currentLocationId),
    queryFn: () => fetchServiceCategoriesCached({ localId: currentLocationId }),
  });
  const programs = useMemo(
    () => programsQuery.data ?? EMPTY_PROGRAMS,
    [programsQuery.data],
  );
  const services = useMemo(
    () => servicesQuery.data ?? EMPTY_SERVICES,
    [servicesQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? EMPTY_SERVICE_CATEGORIES,
    [categoriesQuery.data],
  );
  const isLoading = programsQuery.isLoading || servicesQuery.isLoading || categoriesQuery.isLoading;
  const scopeLabels = useMemo(
    () =>
      (Object.entries(SCOPE_KEYS) as Array<[LoyaltyScope, string]>).reduce(
        (acc, [key, labelKey]) => {
          acc[key] = t(labelKey);
          return acc;
        },
        {} as Record<LoyaltyScope, string>,
      ),
    [t],
  );

  useEffect(() => {
    if (!programsQuery.error && !servicesQuery.error && !categoriesQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.loyalty.toast.loadError'),
      variant: 'destructive',
    });
  }, [categoriesQuery.error, programsQuery.error, servicesQuery.error, t, toast]);

  const openDialog = (program?: LoyaltyProgram) => {
    setEditingProgram(program || null);
    setForm({
      name: program?.name || '',
      description: program?.description || '',
      scope: program?.scope || 'global',
      requiredVisits: program ? String(program.requiredVisits) : '10',
      maxCyclesPerClient: program?.maxCyclesPerClient ? String(program.maxCyclesPerClient) : '',
      priority: program ? String(program.priority) : '0',
      isActive: program?.isActive ?? true,
      serviceId: program?.serviceId || 'none',
      categoryId: program?.categoryId || 'none',
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (programId: string) => {
    setDeletingProgramId(programId);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (!form.name.trim()) {
        toast({
          title: t('admin.loyalty.toast.requiredNameTitle'),
          description: t('admin.loyalty.toast.requiredNameDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      const requiredVisits = Number(form.requiredVisits);
      if (!Number.isFinite(requiredVisits) || requiredVisits < 1) {
        toast({
          title: t('admin.loyalty.toast.invalidVisitsTitle'),
          description: t('admin.loyalty.toast.invalidVisitsDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      const priorityValue = Number(form.priority);
      if (!Number.isFinite(priorityValue)) {
        toast({
          title: t('admin.loyalty.toast.invalidPriorityTitle'),
          description: t('admin.loyalty.toast.invalidPriorityDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      const maxCyclesValue = form.maxCyclesPerClient.trim() === ''
        ? null
        : Number(form.maxCyclesPerClient);
      if (maxCyclesValue !== null && (!Number.isFinite(maxCyclesValue) || maxCyclesValue < 1)) {
        toast({
          title: t('admin.loyalty.toast.invalidLimitTitle'),
          description: t('admin.loyalty.toast.invalidLimitDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        scope: form.scope,
        requiredVisits,
        maxCyclesPerClient: maxCyclesValue,
        priority: priorityValue,
        isActive: form.isActive,
        serviceId: form.scope === 'service' ? (form.serviceId === 'none' ? null : form.serviceId) : null,
        categoryId: form.scope === 'category' ? (form.categoryId === 'none' ? null : form.categoryId) : null,
      };

      if (editingProgram) {
        await updateLoyaltyProgram(editingProgram.id, payload);
      } else {
        await createLoyaltyProgram(payload);
      }
      await programsQuery.refetch();

      toast({
        title: t('admin.loyalty.toast.savedTitle'),
        description: t('admin.loyalty.toast.savedDescription'),
      });
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.loyalty.toast.saveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProgramId) return;
    try {
      await deleteLoyaltyProgram(deletingProgramId);
      await programsQuery.refetch();
      toast({ title: t('admin.loyalty.toast.deletedTitle') });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.loyalty.toast.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setDeletingProgramId(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const scopeHelper = useMemo(() => {
    if (form.scope === 'service') return t('admin.loyalty.scopeHelper.service');
    if (form.scope === 'category') return t('admin.loyalty.scopeHelper.category');
    return t('admin.loyalty.scopeHelper.global', { locationFromWithDefinite: copy.location.fromWithDefinite });
  }, [form.scope, copy.location.fromWithDefinite, t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div  className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">{t('admin.loyalty.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.loyalty.subtitle')}
          </p>
        </div>
        <Button variant="glow" onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.loyalty.actions.newCard')}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : programs.length === 0 ? (
        <EmptyState
          icon={Award}
          title={t('admin.loyalty.emptyTitle')}
          description={t('admin.loyalty.emptyDescription')}
          action={{ label: t('admin.loyalty.actions.createCard'), onClick: () => openDialog() }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((program) => (
            <Card key={program.id} variant="elevated">
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{scopeLabels[program.scope]}</p>
                  </div>
                  <Switch
                    checked={program.isActive}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateLoyaltyProgram(program.id, { isActive: checked });
                        await programsQuery.refetch();
                      } catch (error) {
                        toast({
                          title: t('admin.common.error'),
                          description: t('admin.loyalty.toast.updateStatusError'),
                          variant: 'destructive',
                        });
                      }
                    }}
                  />
                </div>
                {program.description && (
                  <p className="text-sm text-muted-foreground">{program.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('admin.loyalty.fields.requiredVisits')}</span>
                    <span className="font-semibold">{program.requiredVisits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('admin.loyalty.fields.maxCycles')}</span>
                    <span className="font-medium">
                      {program.maxCyclesPerClient
                        ? `x${program.maxCyclesPerClient}`
                        : t('admin.loyalty.noLimit')}
                    </span>
                  </div>
                  {program.scope === 'service' && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('admin.common.table.service')}</span>
                      <span className="font-medium">{program.serviceName || t('admin.loyalty.unassigned')}</span>
                    </div>
                  )}
                  {program.scope === 'category' && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('admin.services.fields.category')}</span>
                      <span className="font-medium">{program.categoryName || t('admin.loyalty.unassigned')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('admin.loyalty.fields.priority')}</span>
                    <span className="font-medium">{program.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDialog(program)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    {t('admin.common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openDeleteDialog(program.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t('admin.roles.actions.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? t('admin.loyalty.dialog.editTitle') : t('admin.loyalty.dialog.newTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.loyalty.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="loyalty-name">{t('admin.loyalty.fields.name')}</Label>
                <InlineTranslationPopover
                  entityType="loyalty_program"
                  entityId={editingProgram?.id}
                  fieldKey="name"
                  onUpdated={async () => {
                    await programsQuery.refetch();
                  }}
                />
              </div>
              <Input
                id="loyalty-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('admin.loyalty.fields.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="loyalty-description">{t('admin.services.fields.description')}</Label>
                <InlineTranslationPopover
                  entityType="loyalty_program"
                  entityId={editingProgram?.id}
                  fieldKey="description"
                  onUpdated={async () => {
                    await programsQuery.refetch();
                  }}
                />
              </div>
              <Textarea
                id="loyalty-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t('admin.loyalty.fields.descriptionPlaceholder')}
                className="min-h-[90px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.loyalty.fields.scope')}</Label>
                <Select
                  value={form.scope}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      scope: value as LoyaltyScope,
                      serviceId: 'none',
                      categoryId: 'none',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.loyalty.fields.selectScope')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">{t('admin.loyalty.scope.global')}</SelectItem>
                    <SelectItem value="service">{t('admin.loyalty.scope.service')}</SelectItem>
                    <SelectItem value="category">{t('admin.loyalty.scope.category')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{scopeHelper}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.loyalty.fields.requiredVisits')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.requiredVisits}
                  onChange={(event) => setForm((prev) => ({ ...prev, requiredVisits: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.loyalty.fields.maxCyclesOptional')}</Label>
              <Input
                type="number"
                min="1"
                placeholder={t('admin.loyalty.noLimit')}
                value={form.maxCyclesPerClient}
                onChange={(event) => setForm((prev) => ({ ...prev, maxCyclesPerClient: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.loyalty.fields.maxCyclesHint')}
              </p>
            </div>
            {form.scope === 'service' && (
              <div className="space-y-2">
                <Label>{t('admin.common.table.service')}</Label>
                <Select
                  value={form.serviceId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, serviceId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.loyalty.fields.selectService')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('admin.loyalty.fields.selectService')}</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === 'category' && (
              <div className="space-y-2">
                <Label>{t('admin.services.fields.category')}</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.loyalty.fields.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('admin.loyalty.fields.selectCategory')}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.loyalty.fields.priority')}</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.loyalty.fields.priorityHint')}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('admin.loyalty.fields.activeCard')}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.loyalty.fields.activeCardHint')}</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingProgram ? t('admin.services.actions.saveChanges') : t('admin.loyalty.actions.createCard')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('admin.loyalty.deleteDialog.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.loyalty.deleteDialog.srDescription')}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('admin.loyalty.deleteDialog.description')}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('appointmentEditor.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('admin.roles.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLoyalty;
