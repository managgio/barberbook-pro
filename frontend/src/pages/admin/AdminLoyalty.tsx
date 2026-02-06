import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
} from '@/data/api';
import { LoyaltyProgram, LoyaltyScope, Service, ServiceCategory } from '@/data/types';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { fetchServiceCategoriesCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useTenant } from '@/context/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const scopeLabels: Record<LoyaltyScope, string> = {
  global: 'Global',
  service: 'Por servicio',
  category: 'Por categoría',
};
const EMPTY_PROGRAMS: LoyaltyProgram[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_SERVICE_CATEGORIES: ServiceCategory[] = [];

const AdminLoyalty: React.FC = () => {
  const { toast } = useToast();
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

  useEffect(() => {
    if (!programsQuery.error && !servicesQuery.error && !categoriesQuery.error) return;
    toast({
      title: 'Error',
      description: 'No se pudo cargar la fidelización. Revisa si está habilitada en la plataforma.',
      variant: 'destructive',
    });
  }, [categoriesQuery.error, programsQuery.error, servicesQuery.error, toast]);

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
        toast({ title: 'Nombre requerido', description: 'Indica el nombre de la tarjeta.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      const requiredVisits = Number(form.requiredVisits);
      if (!Number.isFinite(requiredVisits) || requiredVisits < 1) {
        toast({
          title: 'Cupos inválidos',
          description: 'Introduce un número de visitas válido.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      const priorityValue = Number(form.priority);
      if (!Number.isFinite(priorityValue)) {
        toast({
          title: 'Prioridad inválida',
          description: 'La prioridad debe ser un número.',
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
          title: 'Límite inválido',
          description: 'El límite por cliente debe ser un número mayor o igual a 1.',
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
        title: 'Tarjeta guardada',
        description: 'La configuración de fidelización se actualizó.',
      });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la tarjeta.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProgramId) return;
    try {
      await deleteLoyaltyProgram(deletingProgramId);
      await programsQuery.refetch();
      toast({ title: 'Tarjeta eliminada' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la tarjeta.', variant: 'destructive' });
    } finally {
      setDeletingProgramId(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const scopeHelper = useMemo(() => {
    if (form.scope === 'service') return 'Se aplicará solo al servicio seleccionado.';
    if (form.scope === 'category') return 'Se aplicará a cualquier servicio de la categoría.';
    return `Se aplicará a cualquier servicio ${copy.location.fromWithDefinite}.`;
  }, [form.scope, copy.location.fromWithDefinite]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div  className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Fidelización</h1>
          <p className="text-muted-foreground mt-1">
            Configura tarjetas de fidelización para incentivar las visitas recurrentes.
          </p>
        </div>
        <Button variant="glow" onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva tarjeta
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
          title="Sin tarjetas de fidelización"
          description="Crea tu primera tarjeta para premiar a los clientes más fieles."
          action={{ label: 'Crear tarjeta', onClick: () => openDialog() }}
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
                        toast({ title: 'Error', description: 'No se pudo actualizar el estado.', variant: 'destructive' });
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
                    <span className="text-muted-foreground">Cupos necesarios</span>
                    <span className="font-semibold">{program.requiredVisits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Límite por cliente</span>
                    <span className="font-medium">
                      {program.maxCyclesPerClient ? `x${program.maxCyclesPerClient}` : 'Sin límite'}
                    </span>
                  </div>
                  {program.scope === 'service' && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Servicio</span>
                      <span className="font-medium">{program.serviceName || 'Sin asignar'}</span>
                    </div>
                  )}
                  {program.scope === 'category' && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categoría</span>
                      <span className="font-medium">{program.categoryName || 'Sin asignar'}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prioridad</span>
                    <span className="font-medium">{program.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDialog(program)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openDeleteDialog(program.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
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
            <DialogTitle>{editingProgram ? 'Editar tarjeta' : 'Nueva tarjeta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loyalty-name">Nombre</Label>
              <Input
                id="loyalty-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ej. Tarjeta 10 cortes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loyalty-description">Descripción</Label>
              <Textarea
                id="loyalty-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Motiva a los clientes con un servicio gratis"
                className="min-h-[90px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ámbito</Label>
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
                    <SelectValue placeholder="Selecciona ámbito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="service">Por servicio</SelectItem>
                    <SelectItem value="category">Por categoría</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{scopeHelper}</p>
              </div>
              <div className="space-y-2">
                <Label>Cupos necesarios</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.requiredVisits}
                  onChange={(event) => setForm((prev) => ({ ...prev, requiredVisits: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Límite por cliente (opcional)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Sin límite"
                value={form.maxCyclesPerClient}
                onChange={(event) => setForm((prev) => ({ ...prev, maxCyclesPerClient: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Si lo dejas vacío, la tarjeta se puede completar sin límite.
              </p>
            </div>
            {form.scope === 'service' && (
              <div className="space-y-2">
                <Label>Servicio</Label>
                <Select
                  value={form.serviceId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, serviceId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecciona servicio</SelectItem>
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
                <Label>Categoría</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecciona categoría</SelectItem>
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
                <Label>Prioridad</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Mayor prioridad gana cuando hay varias tarjetas aplicables.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Tarjeta activa</p>
                  <p className="text-xs text-muted-foreground">Los clientes podrán usarla al reservar.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingProgram ? 'Guardar cambios' : 'Crear tarjeta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar tarjeta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Quieres eliminar esta tarjeta? No afectará a las citas ya registradas.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLoyalty;
