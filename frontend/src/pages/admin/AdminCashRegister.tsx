import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  createCashMovement,
  deleteCashMovement,
  getAppointmentsByDate,
  getAppointmentsByDateForLocal,
  getBarbers,
  getCashMovements,
  getCashMovementsForLocal,
} from '@/data/api';
import { Appointment, Barber, CashMovement, CashMovementType, PaymentMethod } from '@/data/types';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Banknote,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Clock,
  BadgeDollarSign,
  Building2,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useTenant } from '@/context/TenantContext';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const methodLabels: Record<PaymentMethod | 'unknown', string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  bizum: 'Bizum',
  unknown: 'Sin método',
};

const METHOD_COLORS: Record<PaymentMethod | 'unknown', string> = {
  cash: '#22c55e',
  card: '#0ea5e9',
  bizum: '#f97316',
  unknown: '#94a3b8',
};

const methodIcons: Record<PaymentMethod | 'unknown', React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  bizum: Wallet,
  unknown: BadgeDollarSign,
};

const AdminCashRegister: React.FC = () => {
  const { toast } = useToast();
  const { locations, currentLocationId } = useTenant();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);
  const [netAllLocations, setNetAllLocations] = useState<number | null>(null);
  const [paymentBarberFilter, setPaymentBarberFilter] = useState<string>('all');
  const [barberPaymentMethodFilter, setBarberPaymentMethodFilter] = useState<
    'all' | PaymentMethod | 'unknown'
  >('all');
  const [movementDraft, setMovementDraft] = useState<{
    type: CashMovementType;
    amount: string;
    method: PaymentMethod | '';
    note: string;
  }>({
    type: 'in',
    amount: '',
    method: 'cash',
    note: '',
  });

  const calculateNetTotal = useCallback((appts: Appointment[], moves: CashMovement[]) => {
    const completedTotal = appts.filter((apt) => apt.status === 'completed')
      .reduce((acc, apt) => acc + apt.price, 0);
    const manualInTotal = moves.filter((movement) => movement.type === 'in')
      .reduce((acc, movement) => acc + movement.amount, 0);
    const manualOutTotal = moves.filter((movement) => movement.type === 'out')
      .reduce((acc, movement) => acc + movement.amount, 0);
    return completedTotal + manualInTotal - manualOutTotal;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [appointmentsData, barbersData, movementsData] = await Promise.all([
        getAppointmentsByDate(selectedDate),
        getBarbers(),
        getCashMovements(selectedDate),
      ]);
      setAppointments(appointmentsData);
      setBarbers(barbersData);
      setMovements(movementsData);
      const localNet = calculateNetTotal(appointmentsData, movementsData);
      const locationIds = (locations || []).map((loc) => loc.id).filter(Boolean);
      if (!currentLocationId || locationIds.length <= 1) {
        setNetAllLocations(localNet);
      } else {
        const otherIds = locationIds.filter((id) => id !== currentLocationId);
        const otherData = await Promise.all(
          otherIds.map(async (localId) => {
            const [appts, moves] = await Promise.all([
              getAppointmentsByDateForLocal(selectedDate, localId),
              getCashMovementsForLocal(selectedDate, localId),
            ]);
            return calculateNetTotal(appts, moves);
          }),
        );
        const combined = localNet + otherData.reduce((acc, value) => acc + value, 0);
        setNetAllLocations(combined);
      }
    } catch (error) {
      toast({
        title: 'No se pudo cargar la caja',
        description: 'Revisa tu conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, toast, calculateNetTotal, locations, currentLocationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'completed'),
    [appointments],
  );
  const pendingAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'scheduled'),
    [appointments],
  );
  const cancelledAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'cancelled' || appointment.status === 'no_show'),
    [appointments],
  );

  const appointmentIncome = useMemo(
    () => completedAppointments.reduce((acc, appointment) => acc + appointment.price, 0),
    [completedAppointments],
  );
  const pendingIncome = useMemo(
    () => pendingAppointments.reduce((acc, appointment) => acc + appointment.price, 0),
    [pendingAppointments],
  );
  const manualIn = useMemo(
    () => movements.filter((movement) => movement.type === 'in').reduce((acc, movement) => acc + movement.amount, 0),
    [movements],
  );
  const manualOut = useMemo(
    () => movements.filter((movement) => movement.type === 'out').reduce((acc, movement) => acc + movement.amount, 0),
    [movements],
  );
  const totalIncome = appointmentIncome + manualIn;
  const netTotal = totalIncome - manualOut;
  const effectiveNetTotal = netAllLocations ?? netTotal;
  const ticketAverage = completedAppointments.length ? appointmentIncome / completedAppointments.length : 0;
  const hasMultipleLocations = locations.length > 1;

  const paymentFilteredAppointments = useMemo(() => {
    if (paymentBarberFilter === 'all') return completedAppointments;
    return completedAppointments.filter((appointment) => appointment.barberId === paymentBarberFilter);
  }, [completedAppointments, paymentBarberFilter]);

  const methodTotals = useMemo(() => {
    const totals: Record<PaymentMethod | 'unknown', number> = {
      cash: 0,
      card: 0,
      bizum: 0,
      unknown: 0,
    };
    paymentFilteredAppointments.forEach((appointment) => {
      const key = appointment.paymentMethod ?? 'unknown';
      totals[key] += appointment.price;
    });
    if (paymentBarberFilter === 'all') {
      movements
        .filter((movement) => movement.type === 'in')
        .forEach((movement) => {
          const key = movement.method ?? 'unknown';
          totals[key] += movement.amount;
        });
    }
    return totals;
  }, [paymentFilteredAppointments, movements, paymentBarberFilter]);

  const methodData = useMemo(
    () =>
      (Object.keys(methodTotals) as Array<PaymentMethod | 'unknown'>)
        .map((key) => ({
          name: methodLabels[key],
          value: methodTotals[key],
          color: METHOD_COLORS[key],
          key,
        }))
        .filter((item) => item.value > 0),
    [methodTotals],
  );

  const barberTotals = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    const filtered = completedAppointments.filter((appointment) => {
      if (barberPaymentMethodFilter === 'all') return true;
      if (barberPaymentMethodFilter === 'unknown') return !appointment.paymentMethod;
      return appointment.paymentMethod === barberPaymentMethodFilter;
    });
    filtered.forEach((appointment) => {
      const current = totals.get(appointment.barberId) || { total: 0, count: 0 };
      totals.set(appointment.barberId, {
        total: current.total + appointment.price,
        count: current.count + 1,
      });
    });
    const rows = barbers
      .map((barber) => ({
        id: barber.id,
        name: barber.name,
        total: totals.get(barber.id)?.total || 0,
        count: totals.get(barber.id)?.count || 0,
      }))
      .filter((row) => row.total > 0 || row.count > 0)
      .sort((a, b) => b.total - a.total);
    return rows;
  }, [barbers, completedAppointments, barberPaymentMethodFilter]);

  const maxBarberTotal = barberTotals.reduce((max, row) => Math.max(max, row.total), 0);

  const handleCreateMovement = async () => {
    if (isSavingMovement) return;
    const normalizedAmount = movementDraft.amount.trim().replace(',', '.');
    const amount = Number(normalizedAmount);
    if (!normalizedAmount || Number.isNaN(amount) || amount <= 0) {
      toast({
        title: 'Importe inválido',
        description: 'Introduce un importe válido para la caja.',
        variant: 'destructive',
      });
      return;
    }
    if (movementDraft.type === 'in' && !movementDraft.method) {
      toast({
        title: 'Método requerido',
        description: 'Selecciona un método de pago para la entrada.',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingMovement(true);
    try {
      const occurredAt = `${selectedDate}T12:00:00`;
      const created = await createCashMovement({
        type: movementDraft.type,
        amount,
        method: movementDraft.method || null,
        note: movementDraft.note.trim() || undefined,
        occurredAt,
      });
      setMovements((prev) => [created, ...prev]);
      setMovementDraft((prev) => ({
        ...prev,
        amount: '',
        note: '',
      }));
      toast({ title: 'Movimiento guardado', description: 'La caja se actualizó correctamente.' });
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingMovement(false);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (deletingMovementId) return;
    setDeletingMovementId(movementId);
    try {
      await deleteCashMovement(movementId);
      setMovements((prev) => prev.filter((movement) => movement.id !== movementId));
      toast({ title: 'Movimiento eliminado', description: 'La caja se actualizó.' });
    } catch (error) {
      toast({
        title: 'No se pudo eliminar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setDeletingMovementId(null);
    }
  };

  const quickSetDate = (daysAgo: number) => {
    setSelectedDate(format(subDays(new Date(), daysAgo), 'yyyy-MM-dd'));
  };

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0];
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
        <p className="font-medium">{entry.name || 'Sin etiqueta'}</p>
        <p className="text-muted-foreground">{currencyFormatter.format(entry.value ?? 0)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Caja Registradora</h1>
          <p className="text-muted-foreground mt-1">
            Calcula el cierre diario, controla entradas y salidas, y revisa los métodos de pago.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => quickSetDate(1)}>
            Ayer
          </Button>
          <Button variant="outline" size="sm" onClick={() => quickSetDate(0)}>
            Hoy
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <div
        className={`grid gap-4 md:grid-cols-2 ${hasMultipleLocations ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}
      >
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del día</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500 md:w-5 md:h-5 lg:w-6 lg:h-6" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{currencyFormatter.format(totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedAppointments.length} citas completadas · {currencyFormatter.format(ticketAverage)} ticket medio
            </p>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salidas registradas</CardTitle>
            <TrendingDown className="w-4 h-4 text-rose-500 md:w-5 md:h-5 lg:w-6 lg:h-6" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{currencyFormatter.format(manualOut)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {movements.filter((movement) => movement.type === 'out').length} movimientos de salida
            </p>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Neto estimado</CardTitle>
            <BadgeDollarSign className="w-4 h-4 text-indigo-500 md:w-5 md:h-5 lg:w-6 lg:h-6" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{currencyFormatter.format(netTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Solo incluye el local actual.
            </p>
          </CardContent>
        </Card>
        {hasMultipleLocations && (
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Neto total</CardTitle>
              <Building2 className="w-4 h-4 text-primary md:w-5 md:h-5 lg:w-6 lg:h-6" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">
                {currencyFormatter.format(effectiveNetTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Suma {locations.length} locales.
              </p>
            </CardContent>
          </Card>
        )}
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes hoy</CardTitle>
            <Clock className="w-4 h-4 text-amber-500 md:w-5 md:h-5 lg:w-6 lg:h-6" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{currencyFormatter.format(pendingIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingAppointments.length} citas programadas · {cancelledAppointments.length} incidencias
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated" className="min-w-0">
          <CardHeader className="space-y-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Fuentes de pago</CardTitle>
              <Select value={paymentBarberFilter} onValueChange={setPaymentBarberFilter}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="Filtrar barbero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los barberos</SelectItem>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Distribución de ingresos confirmados
              {paymentBarberFilter === 'all' ? ' y entradas manuales.' : ' por barbero (sin movimientos manuales).'}
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="h-56">
              {methodData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay ingresos para este día.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {methodData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-3">
              {(Object.keys(methodTotals) as Array<PaymentMethod | 'unknown'>).map((key) => {
                const Icon = methodIcons[key];
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="w-4 h-4" />
                      {methodLabels[key]}
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(methodTotals[key])}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="flex flex-col">
          <CardHeader className="space-y-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Ingresos por barbero</CardTitle>
              <Select
                value={barberPaymentMethodFilter}
                onValueChange={(value) => setBarberPaymentMethodFilter(value as 'all' | PaymentMethod | 'unknown')}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los métodos</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="bizum">Bizum</SelectItem>
                  <SelectItem value="unknown">Sin método</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Totales de citas completadas para el día seleccionado.
            </p>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {barberTotals.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay citas completadas en esta fecha.
              </div>
            ) : (
              barberTotals.map((barber) => (
                <div key={barber.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{barber.name}</p>
                      <p className="text-xs text-muted-foreground">{barber.count} servicios</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(barber.total)}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${maxBarberTotal ? (barber.total / maxBarberTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated" className="flex flex-col">
        <CardHeader className="space-y-1">
          <CardTitle>Movimientos de caja</CardTitle>
          <p className="text-sm text-muted-foreground">
            Añade entradas o salidas manuales (compras, ajustes, propinas, etc.).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo</label>
              <Select
                value={movementDraft.type}
                onValueChange={(value) => setMovementDraft((prev) => ({ ...prev, type: value as CashMovementType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Salida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Importe</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={movementDraft.amount}
                onChange={(e) => setMovementDraft((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Método</label>
              <Select
                value={movementDraft.method || 'none'}
                onValueChange={(value) =>
                  setMovementDraft((prev) => ({
                    ...prev,
                    method: value === 'none' ? '' : (value as PaymentMethod),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="bizum">Bizum</SelectItem>
                  <SelectItem value="none">Sin método</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nota</label>
              <Textarea
                value={movementDraft.note}
                onChange={(e) => setMovementDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Ej: Compra de productos"
                className="min-h-[42px] resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreateMovement} disabled={isSavingMovement || isLoading} className="gap-2">
              <Plus className="w-4 h-4" />
              {isSavingMovement ? 'Guardando...' : 'Añadir movimiento'}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Movimientos registrados</p>
              <p className="text-xs text-muted-foreground">
                {movements.length} movimientos
              </p>
            </div>
            <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando movimientos...</p>
              ) : movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay movimientos manuales en esta fecha.</p>
              ) : (
                movements.map((movement) => {
                  const badgeVariant = movement.type === 'in' ? 'default' : 'destructive';
                  const methodLabel = methodLabels[movement.method ?? 'unknown'];
                  return (
                    <div
                      key={movement.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeVariant}>{movement.type === 'in' ? 'Entrada' : 'Salida'}</Badge>
                          <span className="text-xs text-muted-foreground">{methodLabel}</span>
                        </div>
                        <p className="text-sm text-foreground">
                          {movement.note || 'Movimiento sin nota'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(movement.occurredAt), "d MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground">
                          {movement.type === 'in' ? '+' : '-'}
                          {currencyFormatter.format(movement.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMovement(movement.id)}
                          disabled={deletingMovementId === movement.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCashRegister;
