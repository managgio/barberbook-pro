import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { getBarbers, createBarber, updateBarber, deleteBarber, getBarberSchedule, updateBarberSchedule } from '@/data/api';
import { Barber, DayKey, ShopSchedule } from '@/data/types';
import { Plus, Pencil, Trash2, Calendar, Loader2, UserCircle, CalendarClock, Copy, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dispatchBarbersUpdated, dispatchSchedulesUpdated } from '@/lib/adminEvents';
import { CardSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { BarberPhotoUploader, PhotoChangePayload, cropAndCompress } from '@/components/admin/BarberPhotoUploader';
import defaultAvatar from '@/assets/img/default-image.webp';
import { deleteFromImageKit, uploadToImageKit } from '@/lib/imagekit';

const DAY_LABELS: { key: DayKey; label: string; short: string }[] = [
  { key: 'monday', label: 'Lunes', short: 'Lun' },
  { key: 'tuesday', label: 'Martes', short: 'Mar' },
  { key: 'wednesday', label: 'Miércoles', short: 'Mié' },
  { key: 'thursday', label: 'Jueves', short: 'Jue' },
  { key: 'friday', label: 'Viernes', short: 'Vie' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

const SHIFT_KEYS = ['morning', 'afternoon'] as const;
type ShiftKey = (typeof SHIFT_KEYS)[number];

const SHIFT_LABELS: Record<ShiftKey, { label: string; hint: string }> = {
  morning: {
    label: 'Turno de mañana',
    hint: 'Configura el bloque matutino.',
  },
  afternoon: {
    label: 'Turno de tarde',
    hint: 'Configura el bloque vespertino.',
  },
};

const cloneSchedule = (schedule: ShopSchedule) => JSON.parse(JSON.stringify(schedule)) as ShopSchedule;

const AdminBarbers: React.FC = () => {
  const { toast } = useToast();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [deletingBarberId, setDeletingBarberId] = useState<string | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<{ open: boolean; barber: Barber | null }>({ open: false, barber: null });
  const [scheduleForm, setScheduleForm] = useState<ShopSchedule | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [scheduleCache, setScheduleCache] = useState<Record<string, ShopSchedule>>({});
  const [copiedSchedule, setCopiedSchedule] = useState<ShopSchedule | null>(null);
  const [copySource, setCopySource] = useState(0);
  const todayISO = new Date().toISOString().split('T')[0];
  const [pendingPhoto, setPendingPhoto] = useState<{ dataUrl: string; zoom: number } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [originalPhotoFileId, setOriginalPhotoFileId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    photo: defaultAvatar,
    photoFileId: null as string | null,
    specialty: '',
    bio: '',
    startDate: todayISO,
    endDate: '',
    isActive: true,
  });

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    const data = await getBarbers();
    setBarbers(data);
    setIsLoading(false);
  };

  const openCreateDialog = () => {
    setEditingBarber(null);
    setFormData({ name: '', photo: defaultAvatar, photoFileId: null, specialty: '', bio: '', startDate: todayISO, endDate: '', isActive: true });
    setPendingPhoto(null);
    setRemovePhoto(false);
    setOriginalPhotoFileId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (barber: Barber) => {
    setEditingBarber(barber);
    setFormData({
      name: barber.name,
      photo: barber.photo || defaultAvatar,
      photoFileId: barber.photoFileId || null,
      specialty: barber.specialty,
      bio: barber.bio || '',
      startDate: barber.startDate || todayISO,
      endDate: barber.endDate || '',
      isActive: barber.isActive ?? true,
    });
    setPendingPhoto(null);
    setRemovePhoto(false);
    setOriginalPhotoFileId(barber.photoFileId || null);
    setIsDialogOpen(true);
  };

  const handlePhotoChange = (change: PhotoChangePayload) => {
    setFormData((prev) => ({
      ...prev,
      photo: change.previewUrl,
      photoFileId: change.remove ? null : change.dataUrl ? null : prev.photoFileId,
    }));

    if (change.remove) {
      setPendingPhoto(null);
      setRemovePhoto(true);
      return;
    }

    if (change.dataUrl) {
      setPendingPhoto({ dataUrl: change.dataUrl, zoom: change.zoom ?? 1.05 });
      setRemovePhoto(false);
      return;
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingBarberId(id);
    setIsDeleteDialogOpen(true);
  };

  const openScheduleDialog = async (barber: Barber) => {
    setScheduleDialog({ open: true, barber });
    setIsScheduleLoading(true);
    try {
      const existing = scheduleCache[barber.id];
      const schedule = existing || await getBarberSchedule(barber.id);
      if (!existing) {
        setScheduleCache(prev => ({ ...prev, [barber.id]: schedule }));
      }
      setScheduleForm(cloneSchedule(schedule));
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar el horario.', variant: 'destructive' });
      setScheduleDialog({ open: false, barber: null });
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const otherBarbers = useMemo(
    () => scheduleDialog.barber ? barbers.filter((b) => b.id !== scheduleDialog.barber?.id) : [],
    [barbers, scheduleDialog.barber]
  );

  const closeScheduleDialog = () => {
    setScheduleDialog({ open: false, barber: null });
    setScheduleForm(null);
    setCopySource(0);
    setIsScheduleLoading(false);
    setIsScheduleSaving(false);
  };

  const handleShiftTimeChange = (
    day: DayKey,
    shift: ShiftKey,
    field: 'start' | 'end',
    value: string
  ) => {
    setScheduleForm(prev =>
      prev
        ? {
            ...prev,
            [day]: {
              ...prev[day],
              [shift]: {
                ...prev[day][shift],
                [field]: value,
              },
            },
          }
        : prev
    );
  };

  const handleShiftToggle = (day: DayKey, shift: ShiftKey, enabled: boolean) => {
    setScheduleForm(prev => {
      if (!prev) return prev;
      const updatedDay = {
        ...prev[day],
        [shift]: {
          ...prev[day][shift],
          enabled,
        },
      };
      if (enabled) {
        updatedDay.closed = false;
      } else if (!updatedDay.morning.enabled && !updatedDay.afternoon.enabled) {
        updatedDay.closed = true;
      }
      return {
        ...prev,
        [day]: updatedDay,
      };
    });
  };

  const handleScheduleClosed = (day: DayKey, closed: boolean) => {
    setScheduleForm(prev => {
      if (!prev) return prev;
      const updatedDay = {
        ...prev[day],
        closed,
      };
      if (!closed && !updatedDay.morning.enabled && !updatedDay.afternoon.enabled) {
        updatedDay.morning = { ...updatedDay.morning, enabled: true };
      }
      return {
        ...prev,
        [day]: updatedDay,
      };
    });
  };

  const handleEndOverflowMinutesChange = (value: string) => {
    setScheduleForm(prev => {
      if (!prev) return prev;
      if (value.trim() === '') {
        return { ...prev, endOverflowMinutes: undefined };
      }
      const parsed = Math.max(0, Math.floor(Number(value)));
      return { ...prev, endOverflowMinutes: Number.isFinite(parsed) ? parsed : undefined };
    });
  };

  const handleCopySchedule = () => {
    if (scheduleForm) {
      setCopiedSchedule(cloneSchedule(scheduleForm));
      toast({ title: 'Horario copiado', description: 'Ahora puedes pegarlo en otro barbero.' });
    }
  };

  const handlePasteSchedule = () => {
    if (copiedSchedule) {
      setScheduleForm(cloneSchedule(copiedSchedule));
    }
  };

  const handleCopyFromBarber = async (barberId: string) => {
    if (!barberId) return;
    try {
      const existing = scheduleCache[barberId];
      const schedule = existing || await getBarberSchedule(barberId);
      if (!existing) {
        setScheduleCache(prev => ({ ...prev, [barberId]: schedule }));
      }
      setScheduleForm(cloneSchedule(schedule));
      toast({ title: 'Horario aplicado', description: 'Se ha copiado el horario seleccionado.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar el horario.', variant: 'destructive' });
    } finally {
      setCopySource(prev => prev + 1);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDialog.barber || !scheduleForm) return;
    setIsScheduleSaving(true);
    try {
      const updated = await updateBarberSchedule(scheduleDialog.barber.id, scheduleForm);
      setScheduleCache(prev => ({ ...prev, [scheduleDialog.barber!.id]: updated }));
      dispatchSchedulesUpdated({ source: 'admin-barbers' });
      toast({ title: 'Horario guardado', description: 'Se ha actualizado el horario del barbero.' });
      closeScheduleDialog();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el horario.', variant: 'destructive' });
      setIsScheduleSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let updatedPhoto = formData.photo;
      let updatedPhotoFileId = formData.photoFileId;
      const previousFileId = originalPhotoFileId;
      if (removePhoto) {
        if (previousFileId) {
          try {
            await deleteFromImageKit(previousFileId);
          } catch (cleanupError) {
            console.error(cleanupError);
            toast({
              title: 'Aviso',
              description: 'No se pudo borrar la foto anterior. Revisa el almacenamiento.',
              variant: 'destructive',
            });
          }
        }
        updatedPhoto = defaultAvatar;
        updatedPhotoFileId = null;
      } else if (pendingPhoto) {
        const blob = await cropAndCompress(pendingPhoto.dataUrl, pendingPhoto.zoom);
        const fileName = `barber-${Date.now()}.webp`;
        const { url, fileId } = await uploadToImageKit(blob, fileName, 'barbers');
        updatedPhoto = url;
        updatedPhotoFileId = fileId;

        if (previousFileId && previousFileId !== fileId) {
          try {
            await deleteFromImageKit(previousFileId);
          } catch (cleanupError) {
            console.error(cleanupError);
            toast({
              title: 'Aviso',
              description: 'No se pudo borrar la foto anterior. Revisa el almacenamiento.',
              variant: 'destructive',
            });
          }
        }
      }

      if (editingBarber) {
        await updateBarber(editingBarber.id, {
          name: formData.name,
          photo: updatedPhoto,
          photoFileId: updatedPhotoFileId,
          specialty: formData.specialty,
          bio: formData.bio,
          role: 'worker',
          startDate: formData.startDate,
          endDate: formData.endDate ? formData.endDate : null,
          isActive: formData.isActive,
        });
        toast({ title: 'Barbero actualizado', description: 'Los cambios han sido guardados.' });
      } else {
        await createBarber({
          name: formData.name,
          photo: updatedPhoto,
          photoFileId: updatedPhotoFileId,
          specialty: formData.specialty,
          bio: formData.bio,
          role: 'worker',
          startDate: formData.startDate,
          endDate: formData.endDate ? formData.endDate : null,
          isActive: formData.isActive,
        });
        toast({ title: 'Barbero añadido', description: 'El nuevo barbero ha sido añadido.' });
      }
      
      await fetchBarbers();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el barbero.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBarberId) return;
    
    try {
      await deleteBarber(deletingBarberId);
      toast({ title: 'Barbero eliminado', description: 'El barbero ha sido eliminado.' });
      await fetchBarbers();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el barbero.', variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingBarberId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Barberos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el equipo y sus festivos.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo barbero
        </Button>
      </div>

      {/* Barbers Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : barbers.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {barbers.map((barber) => (
            <Card key={barber.id} variant="elevated">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <img 
                    src={barber.photo || defaultAvatar} 
                    alt={barber.name}
                    className="w-24 h-24 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{barber.name}</h3>
                        <p className="text-sm text-primary">{barber.specialty}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openScheduleDialog(barber)}>
                          <CalendarClock className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(barber)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(barber.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        barber.isActive === false
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {barber.isActive === false ? 'Oculto' : 'Activo'}
                      </span>
                    </div>
                    {barber.bio && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{barber.bio}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Inicio: {barber.startDate ? new Date(barber.startDate).toLocaleDateString() : 'Sin definir'}
                      {barber.endDate && ` · Fin: ${new Date(barber.endDate).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UserCircle}
          title="Sin barberos"
          description="Añade barberos para gestionar el equipo."
          action={{ label: 'Añadir barbero', onClick: openCreateDialog }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBarber ? 'Editar barbero' : 'Nuevo barbero'}
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
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <BarberPhotoUploader
                  value={formData.photo}
                  onChange={handlePhotoChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidad</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Ej: Cortes clásicos"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Biografía</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Breve descripción..."
                />
              </div>
              <div className="space-y-2">
                <Label>Visible para clientes</Label>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm text-muted-foreground">Mostrar en el panel de reservas</span>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha fin (opcional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingBarber ? 'Guardar cambios' : 'Añadir barbero'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialog.open} onOpenChange={(open) => {
        if (!open) {
          closeScheduleDialog();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Horario de {scheduleDialog.barber?.name}
            </DialogTitle>
          </DialogHeader>
          {isScheduleLoading || !scheduleForm ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="outline" size="sm" onClick={handleCopySchedule}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar horario
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasteSchedule}
                  disabled={!copiedSchedule}
                >
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                  Pegar horario copiado
                </Button>
                <Select key={copySource} onValueChange={handleCopyFromBarber} disabled={otherBarbers.length === 0}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Copiar desde otro barbero" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherBarbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id}>
                        {barber.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                <div className="space-y-2 max-w-xs">
                  <Label className="text-sm">Tolerancia fin de jornada (minutos)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={scheduleForm.endOverflowMinutes ?? ''}
                    onChange={(e) => handleEndOverflowMinutesChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si lo dejas vacío, se usa el valor configurado en el local.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {DAY_LABELS.map((day) => {
                  const dayData = scheduleForm[day.key];
                  return (
                    <div key={day.key} className="space-y-3 border rounded-2xl p-3 bg-muted/30">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{day.label}</p>
                          <p className="text-xs text-muted-foreground">Define turnos independientes para mañana y tarde.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!dayData.closed}
                            onCheckedChange={(checked) => handleScheduleClosed(day.key, !checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {dayData.closed ? 'Cerrado' : 'Abierto'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {SHIFT_KEYS.map((shiftKey) => {
                          const shift = dayData[shiftKey];
                          const info = SHIFT_LABELS[shiftKey];
                          return (
                            <div key={shiftKey} className="rounded-2xl border border-border/60 bg-background/40 p-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <p className="font-medium text-sm text-foreground">{info.label}</p>
                                  <p className="text-xs text-muted-foreground">{info.hint}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={shift.enabled}
                                    onCheckedChange={(checked) => handleShiftToggle(day.key, shiftKey, checked)}
                                    disabled={dayData.closed}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {shift.enabled ? 'Activo' : 'Inactivo'}
                                  </span>
                                </div>
                              </div>
                              <div className="grid sm:grid-cols-[repeat(2,minmax(140px,1fr))] gap-3 mt-2">
                                <div className="space-y-1 w-full sm:max-w-[200px]">
                                  <Label className="text-xs text-muted-foreground">Inicio</Label>
                                  <Input
                                    type="time"
                                    value={shift.start}
                                    disabled={dayData.closed || !shift.enabled}
                                    className="w-full sm:max-w-[200px]"
                                    onChange={(e) => handleShiftTimeChange(day.key, shiftKey, 'start', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1 w-full sm:max-w-[200px]">
                                  <Label className="text-xs text-muted-foreground">Fin</Label>
                                  <Input
                                    type="time"
                                    value={shift.end}
                                    disabled={dayData.closed || !shift.enabled}
                                    className="w-full sm:max-w-[200px]"
                                    onChange={(e) => handleShiftTimeChange(day.key, shiftKey, 'end', e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeScheduleDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveSchedule} disabled={isScheduleSaving}>
                  {isScheduleSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar horario
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar barbero?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El barbero será eliminado permanentemente.
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
    </div>
  );
};

export default AdminBarbers;
