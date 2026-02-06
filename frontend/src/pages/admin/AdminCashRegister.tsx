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
  getAdminStripeConfig,
  getCashMovements,
  getCashMovementsForLocal,
} from '@/data/api';
import {
  AdminStripeConfig,
  Appointment,
  Barber,
  CashMovement,
  CashMovementProductOperationType,
  CashMovementType,
  PaymentMethod,
  Product,
  ProductCategory,
} from '@/data/types';
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
import ProductSelector from '@/components/common/ProductSelector';
import { getAllNounLabel, useBusinessCopy } from '@/lib/businessCopy';
import {
  fetchAdminProductsCached,
  fetchBarbersCached,
  fetchProductCategoriesCached,
} from '@/lib/catalogQuery';
import { dispatchProductsUpdated } from '@/lib/adminEvents';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const methodLabels: Record<PaymentMethod | 'unknown', string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  bizum: 'Bizum',
  stripe: 'Stripe',
  unknown: 'Sin método',
};

const METHOD_COLORS: Record<PaymentMethod | 'unknown', string> = {
  cash: '#22c55e',
  card: '#0ea5e9',
  bizum: '#f97316',
  stripe: '#635bff',
  unknown: '#94a3b8',
};

const methodIcons: Record<PaymentMethod | 'unknown', React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  bizum: Wallet,
  stripe: CreditCard,
  unknown: BadgeDollarSign,
};

type CashRegisterData = {
  appointments: Appointment[];
  barbers: Barber[];
  movements: CashMovement[];
  products: Product[];
  productCategories: ProductCategory[];
  netAllLocations: number | null;
};

const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_MOVEMENTS: CashMovement[] = [];
const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_PRODUCT_CATEGORIES: ProductCategory[] = [];

const getProductsTotalFromAppointment = (appointment: Appointment) =>
  appointment.products?.reduce((acc, item) => acc + item.totalPrice, 0) ?? 0;

const getAppointmentAmountForCash = (appointment: Appointment, productsEnabled: boolean) => {
  const productsTotal = getProductsTotalFromAppointment(appointment);
  return productsEnabled ? appointment.price : Math.max(0, appointment.price - productsTotal);
};

const calculateNetTotalFromCollections = (
  appointments: Appointment[],
  movements: CashMovement[],
  productsEnabled: boolean,
) => {
  const completedTotal = appointments
    .filter((appointment) => appointment.status === 'completed')
    .reduce((acc, appointment) => acc + getAppointmentAmountForCash(appointment, productsEnabled), 0);
  const manualInTotal = movements
    .filter((movement) => movement.type === 'in')
    .reduce((acc, movement) => acc + movement.amount, 0);
  const manualOutTotal = movements
    .filter((movement) => movement.type === 'out')
    .reduce((acc, movement) => acc + movement.amount, 0);
  return completedTotal + manualInTotal - manualOutTotal;
};

const AdminCashRegister: React.FC = () => {
  const { toast } = useToast();
  const { locations, currentLocationId, tenant } = useTenant();
  const copy = useBusinessCopy();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);
  const [paymentBarberFilter, setPaymentBarberFilter] = useState<string>('all');
  const [barberPaymentMethodFilter, setBarberPaymentMethodFilter] = useState<
    'all' | PaymentMethod | 'unknown'
  >('all');
  const productsEnabled = !(tenant?.config?.adminSidebar?.hiddenSections ?? []).includes('stock');
  const [movementMode, setMovementMode] = useState<'manual' | 'products'>('manual');
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
  const [productMovementDraft, setProductMovementDraft] = useState<{
    operationType: CashMovementProductOperationType;
    method: PaymentMethod | '';
    note: string;
    products: Array<{ productId: string; quantity: number }>;
  }>({
    operationType: 'sale',
    method: 'cash',
    note: '',
    products: [],
  });
  const cashRegisterQuery = useQuery<CashRegisterData>({
    queryKey: queryKeys.cashRegister(currentLocationId, selectedDate, productsEnabled),
    enabled: Boolean(currentLocationId),
    queryFn: async () => {
      const productsPromise: Promise<Product[]> = productsEnabled
        ? fetchAdminProductsCached({ localId: currentLocationId })
        : Promise.resolve([]);
      const categoriesPromise: Promise<ProductCategory[]> = productsEnabled
        ? fetchProductCategoriesCached({ localId: currentLocationId })
        : Promise.resolve([]);

      const [appointmentsData, barbersData, movementsData, productsData, productCategoriesData] = await Promise.all([
        getAppointmentsByDate(selectedDate),
        fetchBarbersCached({ localId: currentLocationId }),
        getCashMovements(selectedDate),
        productsPromise,
        categoriesPromise,
      ]);

      const localNet = calculateNetTotalFromCollections(appointmentsData, movementsData, productsEnabled);
      const locationIds = (locations || []).map((loc) => loc.id).filter(Boolean);
      if (!currentLocationId || locationIds.length <= 1) {
        return {
          appointments: appointmentsData,
          barbers: barbersData,
          movements: movementsData,
          products: productsData,
          productCategories: productCategoriesData,
          netAllLocations: localNet,
        };
      }

      const otherIds = locationIds.filter((id) => id !== currentLocationId);
      const otherData = await Promise.all(
        otherIds.map(async (localId) => {
          const [appts, moves] = await Promise.all([
            getAppointmentsByDateForLocal(selectedDate, localId),
            getCashMovementsForLocal(selectedDate, localId),
          ]);
          return calculateNetTotalFromCollections(appts, moves, productsEnabled);
        }),
      );
      const combined = localNet + otherData.reduce((acc, value) => acc + value, 0);

      return {
        appointments: appointmentsData,
        barbers: barbersData,
        movements: movementsData,
        products: productsData,
        productCategories: productCategoriesData,
        netAllLocations: combined,
      };
    },
  });
  const stripeConfigQuery = useQuery<AdminStripeConfig | null>({
    queryKey: queryKeys.adminStripeConfig(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: async () => {
      try {
        return await getAdminStripeConfig();
      } catch {
        return null;
      }
    },
  });
  const appointments = useMemo(
    () => cashRegisterQuery.data?.appointments ?? EMPTY_APPOINTMENTS,
    [cashRegisterQuery.data?.appointments],
  );
  const barbers = useMemo(
    () => cashRegisterQuery.data?.barbers ?? EMPTY_BARBERS,
    [cashRegisterQuery.data?.barbers],
  );
  const movements = useMemo(
    () => cashRegisterQuery.data?.movements ?? EMPTY_MOVEMENTS,
    [cashRegisterQuery.data?.movements],
  );
  const products = useMemo(
    () => cashRegisterQuery.data?.products ?? EMPTY_PRODUCTS,
    [cashRegisterQuery.data?.products],
  );
  const productCategories = useMemo(
    () => cashRegisterQuery.data?.productCategories ?? EMPTY_PRODUCT_CATEGORIES,
    [cashRegisterQuery.data?.productCategories],
  );
  const netAllLocations = cashRegisterQuery.data?.netAllLocations ?? null;
  const isLoading = cashRegisterQuery.isLoading;
  const stripeConfig = stripeConfigQuery.data ?? null;
  const today = format(new Date(), 'yyyy-MM-dd');
  const stripeEnabled = Boolean(
    stripeConfig?.brandEnabled && stripeConfig?.platformEnabled && stripeConfig?.localEnabled,
  );
  const visibleMethods = useMemo<Array<PaymentMethod | 'unknown'>>(
    () => (
      stripeEnabled
        ? ['cash', 'card', 'bizum', 'stripe', 'unknown']
        : ['cash', 'card', 'bizum', 'unknown']
    ),
    [stripeEnabled],
  );

  const getAppointmentAmount = useCallback(
    (appointment: Appointment) => getAppointmentAmountForCash(appointment, productsEnabled),
    [productsEnabled],
  );

  useEffect(() => {
    if (!cashRegisterQuery.error) return;
    toast({
      title: 'No se pudo cargar la caja',
      description: 'Revisa tu conexión e inténtalo de nuevo.',
      variant: 'destructive',
    });
  }, [cashRegisterQuery.error, toast]);

  useEffect(() => {
    if (!stripeEnabled && barberPaymentMethodFilter === 'stripe') {
      setBarberPaymentMethodFilter('all');
    }
    if (!stripeEnabled && movementDraft.method === 'stripe') {
      setMovementDraft((prev) => ({ ...prev, method: 'cash' }));
    }
    if (!stripeEnabled && productMovementDraft.method === 'stripe') {
      setProductMovementDraft((prev) => ({ ...prev, method: 'cash' }));
    }
  }, [stripeEnabled, barberPaymentMethodFilter, movementDraft.method, productMovementDraft.method]);

  useEffect(() => {
    if (productsEnabled) return;
    setMovementMode('manual');
  }, [productsEnabled]);

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
    () => completedAppointments.reduce((acc, appointment) => acc + getAppointmentAmount(appointment), 0),
    [completedAppointments, getAppointmentAmount],
  );
  const pendingIncome = useMemo(
    () => pendingAppointments.reduce((acc, appointment) => acc + getAppointmentAmount(appointment), 0),
    [pendingAppointments, getAppointmentAmount],
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
      stripe: 0,
      unknown: 0,
    };
    paymentFilteredAppointments.forEach((appointment) => {
      const raw = appointment.paymentMethod ?? 'unknown';
      const key = !stripeEnabled && raw === 'stripe' ? 'card' : raw;
      totals[key] += getAppointmentAmount(appointment);
    });
    return totals;
  }, [paymentFilteredAppointments, getAppointmentAmount, stripeEnabled]);

  const methodData = useMemo(
    () =>
      visibleMethods
        .map((key) => ({
          name: methodLabels[key],
          value: methodTotals[key],
          color: METHOD_COLORS[key],
          key,
        }))
        .filter((item) => item.value > 0),
    [methodTotals, visibleMethods],
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
        total: current.total + getAppointmentAmount(appointment),
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
  }, [barbers, completedAppointments, barberPaymentMethodFilter, getAppointmentAmount]);

  const maxBarberTotal = barberTotals.reduce((max, row) => Math.max(max, row.total), 0);
  const productSales = useMemo(() => {
    if (!productsEnabled) return [];
    const totals = new Map<string, { id: string; name: string; quantity: number; total: number }>();
    completedAppointments.forEach((appointment) => {
      (appointment.products ?? []).forEach((item) => {
        const current = totals.get(item.productId) || {
          id: item.productId,
          name: item.name || 'Producto',
          quantity: 0,
          total: 0,
        };
        totals.set(item.productId, {
          ...current,
          quantity: current.quantity + item.quantity,
          total: current.total + item.totalPrice,
        });
      });
    });
    return [...totals.values()].sort((a, b) => b.total - a.total);
  }, [completedAppointments, productsEnabled]);

  const productSalesSummary = useMemo(() => {
    if (!productsEnabled) return { units: 0, total: 0 };
    return productSales.reduce(
      (acc, item) => ({
        units: acc.units + item.quantity,
        total: acc.total + item.total,
      }),
      { units: 0, total: 0 },
    );
  }, [productSales, productsEnabled]);

  const selectedMovementProductDetails = useMemo(() => {
    return productMovementDraft.products
      .map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) return null;
        const unitAmount = product.finalPrice ?? product.price;
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitAmount,
          totalAmount: unitAmount * item.quantity,
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitAmount: number;
      totalAmount: number;
    }>;
  }, [productMovementDraft.products, products]);

  const selectedMovementProductsSummary = useMemo(() => {
    return selectedMovementProductDetails.reduce(
      (acc, item) => ({
        units: acc.units + item.quantity,
        amount: acc.amount + item.totalAmount,
      }),
      { units: 0, amount: 0 },
    );
  }, [selectedMovementProductDetails]);

  const handleCreateMovement = async () => {
    if (isSavingMovement) return;
    setIsSavingMovement(true);
    try {
      const occurredAt = `${selectedDate}T12:00:00`;
      let created: CashMovement;

      if (movementMode === 'products' && productsEnabled) {
        const amount = selectedMovementProductsSummary.amount;
        if (selectedMovementProductDetails.length === 0 || amount <= 0) {
          toast({
            title: 'Selecciona productos',
            description: 'Añade al menos un producto con cantidad válida.',
            variant: 'destructive',
          });
          return;
        }
        const movementType =
          productMovementDraft.operationType === 'sale' ? 'in' : 'out';
        if (movementType === 'in' && !productMovementDraft.method) {
          toast({
            title: 'Método requerido',
            description: 'Selecciona un método de pago para la venta.',
            variant: 'destructive',
          });
          return;
        }
        created = await createCashMovement({
          type: movementType,
          amount,
          method: productMovementDraft.method || null,
          note: productMovementDraft.note.trim() || undefined,
          occurredAt,
          productOperationType: productMovementDraft.operationType,
          productItems: selectedMovementProductDetails.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
          })),
        });
        setProductMovementDraft((prev) => ({
          ...prev,
          note: '',
          products: [],
        }));
      } else {
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
        created = await createCashMovement({
          type: movementDraft.type,
          amount,
          method: movementDraft.method || null,
          note: movementDraft.note.trim() || undefined,
          occurredAt,
        });
        setMovementDraft((prev) => ({
          ...prev,
          amount: '',
          note: '',
        }));
      }

      await cashRegisterQuery.refetch();
      toast({ title: 'Movimiento guardado', description: 'La caja se actualizó correctamente.' });
      if (created.productOperationType) {
        dispatchProductsUpdated({ source: 'admin-cash-register' });
      }
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
      const deletedMovement = movements.find((movement) => movement.id === movementId);
      await deleteCashMovement(movementId);
      await cashRegisterQuery.refetch();
      if (deletedMovement?.productOperationType) {
        dispatchProductsUpdated({ source: 'admin-cash-register' });
      }
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

  const getMovementProductsSummary = (movement: CashMovement) => {
    const items = movement.productItems || [];
    if (items.length === 0) return '';
    const preview = items
      .slice(0, 2)
      .map((item) => `${item.productName} x${item.quantity}`)
      .join(' · ');
    if (items.length <= 2) return preview;
    return `${preview} · +${items.length - 2} más`;
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
            max={today}
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
              {completedAppointments.length} citas completadas · {pendingAppointments.length}{' '}
              {pendingAppointments.length === 1 ? 'cita pendiente' : 'citas pendientes'}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Neto {copy.location.fromWithDefinite}
            </CardTitle>
            <BadgeDollarSign className="w-4 h-4 text-indigo-500 md:w-5 md:h-5 lg:w-6 lg:h-6" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{currencyFormatter.format(netTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Solo incluye {copy.location.definiteSingular} actual.
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
                Suma {locations.length} {copy.location.pluralLower}.
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
                  <SelectValue placeholder={`Filtrar ${copy.staff.singularLower}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{getAllNounLabel(copy.staff)}</SelectItem>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id}>
                      {barber.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Distribución de ingresos confirmados por citas completadas
              {paymentBarberFilter === 'all' ? '.' : ` por ${copy.staff.singularLower}.`}
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
              {visibleMethods.map((key) => {
                const Icon = methodIcons[key];
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: METHOD_COLORS[key] }}
                        aria-hidden="true"
                      />
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
              <CardTitle>Ingresos por {copy.staff.singularLower}</CardTitle>
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
                  {stripeEnabled && <SelectItem value="stripe">Stripe</SelectItem>}
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

      {productsEnabled && (
        <Card variant="elevated" className="flex flex-col">
          <CardHeader className="space-y-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Ventas de productos</CardTitle>
              <div className="text-xs text-muted-foreground">
                {productSalesSummary.units} unidad(es) · {currencyFormatter.format(productSalesSummary.total)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Productos añadidos en citas completadas para la fecha seleccionada.
            </p>
          </CardHeader>
          <CardContent>
            {productSales.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No hay ventas de productos en esta fecha.
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {productSales.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} unidad(es)</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card variant="elevated" className="flex flex-col">
        <CardHeader className="space-y-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Movimientos de caja</CardTitle>
            {productsEnabled && (
              <div className="inline-flex rounded-lg border border-border/70 bg-muted/20 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={movementMode === 'manual' ? 'default' : 'ghost'}
                  onClick={() => setMovementMode('manual')}
                >
                  Manual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={movementMode === 'products' ? 'default' : 'ghost'}
                  onClick={() => setMovementMode('products')}
                >
                  Productos
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {movementMode === 'products' && productsEnabled
              ? 'Registra compras y ventas sueltas de productos con ajuste automático de stock.'
              : 'Añade entradas o salidas manuales (compras, ajustes, propinas, etc.).'}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {movementMode === 'products' && productsEnabled ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Operación</label>
                  <Select
                    value={productMovementDraft.operationType}
                    onValueChange={(value) =>
                      setProductMovementDraft((prev) => ({
                        ...prev,
                        operationType: value as CashMovementProductOperationType,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona operación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Venta de productos</SelectItem>
                      <SelectItem value="purchase">Compra de productos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tipo</label>
                  <Input
                    value={productMovementDraft.operationType === 'sale' ? 'Entrada' : 'Salida'}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Método</label>
                  <Select
                    value={productMovementDraft.method || 'none'}
                    onValueChange={(value) =>
                      setProductMovementDraft((prev) => ({
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
                      {stripeEnabled && <SelectItem value="stripe">Stripe</SelectItem>}
                      <SelectItem value="none">Sin método</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Importe estimado</label>
                  <Input value={currencyFormatter.format(selectedMovementProductsSummary.amount)} readOnly />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nota</label>
                <Textarea
                  value={productMovementDraft.note}
                  onChange={(e) =>
                    setProductMovementDraft((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                  placeholder={
                    productMovementDraft.operationType === 'sale'
                      ? 'Ej: Venta suelta de productos'
                      : 'Ej: Compra de reposición'
                  }
                  className="min-h-[42px] resize-none"
                />
              </div>
              <ProductSelector
                products={products}
                categories={productCategories}
                selected={productMovementDraft.products}
                onChange={(items) =>
                  setProductMovementDraft((prev) => ({
                    ...prev,
                    products: items,
                  }))
                }
                showStock
                allowOverstock={productMovementDraft.operationType === 'purchase'}
                disabled={isSavingMovement || isLoading}
              />
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span>{selectedMovementProductsSummary.units} unidad(es) seleccionadas</span>
                <span>
                  {productMovementDraft.operationType === 'sale'
                    ? `Reduce stock ${copy.location.fromWithDefinite}`
                    : `Incrementa stock ${copy.location.fromWithDefinite}`}
                </span>
              </div>
            </>
          ) : (
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
                    {stripeEnabled && <SelectItem value="stripe">Stripe</SelectItem>}
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
          )}
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
                <p className="text-sm text-muted-foreground">No hay movimientos de caja en esta fecha.</p>
              ) : (
                movements.map((movement) => {
                  const badgeVariant = movement.type === 'in' ? 'default' : 'destructive';
                  const rawMethod = movement.method ?? 'unknown';
                  const methodKey = !stripeEnabled && rawMethod === 'stripe' ? 'card' : rawMethod;
                  const methodLabel = methodLabels[methodKey];
                  return (
                    <div
                      key={movement.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeVariant}>{movement.type === 'in' ? 'Entrada' : 'Salida'}</Badge>
                          {movement.productOperationType && (
                            <Badge variant="outline">
                              {movement.productOperationType === 'sale' ? 'Venta de productos' : 'Compra de productos'}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{methodLabel}</span>
                        </div>
                        <p className="text-sm text-foreground">
                          {movement.note || 'Movimiento sin nota'}
                        </p>
                        {movement.productItems && movement.productItems.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {getMovementProductsSummary(movement)}
                          </p>
                        )}
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
