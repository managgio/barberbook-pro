import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import EmptyState from '@/components/common/EmptyState';
import { CardSkeleton } from '@/components/common/Skeleton';
import {
  createOffer,
  deleteOffer,
  getOffers,
  updateOffer,
} from '@/data/api/offers';
import {
  Offer,
  OfferScope,
  OfferTarget,
  Product,
  ProductCategory,
  Service,
  ServiceCategory,
} from '@/data/types';
import {
  BadgePercent,
  Boxes,
  Calendar,
  ListChecks,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import {
  fetchAdminProductsCached,
  fetchProductCategoriesCached,
  fetchServiceCategoriesCached,
  fetchServicesCached,
} from '@/lib/catalogQuery';
import { dispatchProductsUpdated, dispatchServicesUpdated } from '@/lib/adminEvents';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';

const SERVICE_SCOPES: OfferScope[] = ['all', 'categories', 'services'];
const PRODUCT_SCOPES: OfferScope[] = ['all', 'categories', 'products'];

const scopeLabels: Record<OfferScope, string> = {
  all: 'Todo el catálogo',
  categories: 'Categorías',
  services: 'Servicios',
  products: 'Productos',
};

const targetLabels: Record<OfferTarget, string> = {
  service: 'Servicios',
  product: 'Productos',
};

const formatDate = (value?: string | null) => (value ? format(parseISO(value), 'dd/MM/yyyy') : 'Sin fecha');

const toggleSelection = (id: string, items: string[]) =>
  items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
const EMPTY_OFFERS: Offer[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_SERVICE_CATEGORIES: ServiceCategory[] = [];
const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_PRODUCT_CATEGORIES: ProductCategory[] = [];

const AdminOffers: React.FC = () => {
  const { toast } = useToast();
  const { currentLocationId } = useTenant();
  const [activeTarget, setActiveTarget] = useState<OfferTarget>('service');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({
    name: '',
    description: '',
    discountType: 'percentage' as Offer['discountType'],
    discountValue: '',
    scope: 'all' as OfferScope,
    categoryIds: [] as string[],
    serviceIds: [] as string[],
    productCategoryIds: [] as string[],
    productIds: [] as string[],
    startDate: '',
    endDate: '',
    active: true,
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettings(currentLocationId),
    queryFn: () => fetchSiteSettingsCached(currentLocationId),
  });
  const offersQuery = useQuery({
    queryKey: queryKeys.offers(currentLocationId, activeTarget),
    queryFn: () => getOffers(activeTarget),
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId),
    queryFn: () => fetchServicesCached({ localId: currentLocationId }),
    enabled: activeTarget === 'service',
  });
  const serviceCategoriesQuery = useQuery({
    queryKey: queryKeys.serviceCategories(currentLocationId),
    queryFn: () => fetchServiceCategoriesCached({ localId: currentLocationId }),
    enabled: activeTarget === 'service',
  });
  const productsQuery = useQuery({
    queryKey: queryKeys.adminProducts(currentLocationId),
    queryFn: () => fetchAdminProductsCached({ localId: currentLocationId }),
    enabled: activeTarget === 'product',
  });
  const productCategoriesQuery = useQuery({
    queryKey: queryKeys.productCategories(currentLocationId),
    queryFn: () => fetchProductCategoriesCached({ localId: currentLocationId }),
    enabled: activeTarget === 'product',
  });
  const settings = settingsQuery.data ?? null;
  const offers = useMemo(
    () => offersQuery.data ?? EMPTY_OFFERS,
    [offersQuery.data],
  );
  const services = useMemo(
    () => servicesQuery.data ?? EMPTY_SERVICES,
    [servicesQuery.data],
  );
  const serviceCategories = useMemo(
    () => serviceCategoriesQuery.data ?? EMPTY_SERVICE_CATEGORIES,
    [serviceCategoriesQuery.data],
  );
  const products = useMemo(
    () => productsQuery.data ?? EMPTY_PRODUCTS,
    [productsQuery.data],
  );
  const productCategories = useMemo(
    () => productCategoriesQuery.data ?? EMPTY_PRODUCT_CATEGORIES,
    [productCategoriesQuery.data],
  );
  const isLoading = settingsQuery.isLoading
    || offersQuery.isLoading
    || (activeTarget === 'service'
      ? servicesQuery.isLoading || serviceCategoriesQuery.isLoading
      : productsQuery.isLoading || productCategoriesQuery.isLoading);

  const categoriesEnabled = activeTarget === 'service'
    ? settings?.services.categoriesEnabled ?? false
    : settings?.products.categoriesEnabled ?? false;
  const productsEnabled = settings?.products.enabled ?? false;
  const showProductTab = productsEnabled;

  const scopeOptions = activeTarget === 'service' ? SERVICE_SCOPES : PRODUCT_SCOPES;
  const dispatchOfferCatalogUpdated = (target: OfferTarget) => {
    if (target === 'service') {
      dispatchServicesUpdated({ source: 'admin-offers' });
      return;
    }
    dispatchProductsUpdated({ source: 'admin-offers' });
  };
  useEffect(() => {
    const hasQueryError = settingsQuery.error
      || offersQuery.error
      || (activeTarget === 'service'
        ? servicesQuery.error || serviceCategoriesQuery.error
        : productsQuery.error || productCategoriesQuery.error);
    if (!hasQueryError) return;
    toast({
      title: 'Error',
      description: 'No se pudieron cargar las ofertas.',
      variant: 'destructive',
    });
  }, [
    activeTarget,
    offersQuery.error,
    productCategoriesQuery.error,
    productsQuery.error,
    serviceCategoriesQuery.error,
    servicesQuery.error,
    settingsQuery.error,
    toast,
  ]);

  useEffect(() => {
    if (settings && !settings.products.enabled && activeTarget === 'product') {
      setActiveTarget('service');
    }
  }, [settings, activeTarget]);

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
      productCategoryIds: offer?.productCategories?.map((c) => c.id) || [],
      productIds: offer?.products?.map((p) => p.id) || [],
      startDate: offer?.startDate ? offer.startDate.slice(0, 10) : '',
      endDate: offer?.endDate ? offer.endDate.slice(0, 10) : '',
      active: offer?.active ?? true,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingOfferId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const discountValue = parseFloat(offerForm.discountValue);
      if (!offerForm.name.trim()) {
        toast({ title: 'Nombre requerido', description: 'Indica el nombre de la oferta.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      if (Number.isNaN(discountValue) || discountValue <= 0) {
        toast({
          title: 'Valor inválido',
          description: 'Introduce un valor mayor que cero.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (offerForm.startDate && offerForm.endDate && offerForm.startDate > offerForm.endDate) {
        toast({
          title: 'Rango inválido',
          description: 'La fecha de inicio debe ser anterior a la fecha final.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (offerForm.scope === 'categories') {
        const hasCategories = activeTarget === 'service'
          ? offerForm.categoryIds.length > 0
          : offerForm.productCategoryIds.length > 0;
        if (!hasCategories) {
          toast({
            title: 'Selecciona categorías',
            description: 'Elige al menos una categoría para esta oferta.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (offerForm.scope === 'services' && offerForm.serviceIds.length === 0) {
        toast({
          title: 'Selecciona servicios',
          description: 'Elige al menos un servicio para esta oferta.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (offerForm.scope === 'products' && offerForm.productIds.length === 0) {
        toast({
          title: 'Selecciona productos',
          description: 'Elige al menos un producto para esta oferta.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        name: offerForm.name.trim(),
        description: offerForm.description || undefined,
        discountType: offerForm.discountType,
        discountValue,
        scope: offerForm.scope,
        target: editingOffer?.target ?? activeTarget,
        categoryIds: offerForm.scope === 'categories' && activeTarget === 'service' ? offerForm.categoryIds : undefined,
        serviceIds: offerForm.scope === 'services' ? offerForm.serviceIds : undefined,
        productCategoryIds: offerForm.scope === 'categories' && activeTarget === 'product'
          ? offerForm.productCategoryIds
          : undefined,
        productIds: offerForm.scope === 'products' ? offerForm.productIds : undefined,
        startDate: offerForm.startDate || undefined,
        endDate: offerForm.endDate || undefined,
        active: offerForm.active,
      };

      if (editingOffer) {
        await updateOffer(editingOffer.id, payload);
        toast({ title: 'Oferta actualizada', description: 'Los cambios se han guardado.' });
      } else {
        await createOffer(payload);
        toast({ title: 'Oferta creada', description: 'La oferta ya está activa.' });
      }

      if (activeTarget === 'service') {
        await Promise.all([
          offersQuery.refetch(),
          servicesQuery.refetch(),
          serviceCategoriesQuery.refetch(),
        ]);
      } else {
        await Promise.all([
          offersQuery.refetch(),
          productsQuery.refetch(),
          productCategoriesQuery.refetch(),
        ]);
      }
      dispatchOfferCatalogUpdated(editingOffer?.target ?? activeTarget);
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar la oferta.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOfferId) return;
    try {
      await deleteOffer(deletingOfferId);
      toast({ title: 'Oferta eliminada', description: 'Se ha retirado correctamente.' });
      if (activeTarget === 'service') {
        await Promise.all([
          offersQuery.refetch(),
          servicesQuery.refetch(),
          serviceCategoriesQuery.refetch(),
        ]);
      } else {
        await Promise.all([
          offersQuery.refetch(),
          productsQuery.refetch(),
          productCategoriesQuery.refetch(),
        ]);
      }
      dispatchOfferCatalogUpdated(activeTarget);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar la oferta.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingOfferId(null);
    }
  };

  const orderedServiceCategories = useMemo(
    () => [...serviceCategories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name)),
    [serviceCategories],
  );

  const orderedProductCategories = useMemo(
    () => [...productCategories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name)),
    [productCategories],
  );

  const orderedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const orderedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  const offerSummary = (offer: Offer) => {
    if (offer.scope === 'all') return 'Aplica a todo el catálogo.';
    if (offer.scope === 'categories') {
      const count = offer.target === 'product'
        ? offer.productCategories?.length ?? 0
        : offer.categories?.length ?? 0;
      return `${count} categoría(s) seleccionadas.`;
    }
    if (offer.scope === 'services') return `${offer.services?.length ?? 0} servicio(s) seleccionados.`;
    if (offer.scope === 'products') return `${offer.products?.length ?? 0} producto(s) seleccionados.`;
    return '';
  };

  const isEmptyState = offers.length === 0 && !isLoading;
  const canCreateOffers = activeTarget === 'product' ? productsEnabled : true;

  const currentCategories = activeTarget === 'service' ? orderedServiceCategories : orderedProductCategories;
  const currentItems = activeTarget === 'service' ? orderedServices : orderedProducts;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Ofertas</h1>
          <p className="text-muted-foreground mt-1">
            {showProductTab
              ? 'Promociones programadas para servicios y productos, con reglas claras.'
              : 'Promociones programadas para servicios, con reglas claras.'}
          </p>
        </div>
        <Button onClick={() => openOfferDialog()} disabled={!canCreateOffers}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva oferta
        </Button>
      </div>

      <Tabs value={activeTarget} onValueChange={(value) => setActiveTarget(value as OfferTarget)}>
        {showProductTab && (
          <TabsList className="grid w-full sm:w-[360px] grid-cols-2">
            <TabsTrigger value="service" className="gap-2">
              <Tag className="w-4 h-4" />
              Servicios
            </TabsTrigger>
            <TabsTrigger value="product" className="gap-2">
              <Boxes className="w-4 h-4" />
              Productos
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value={activeTarget} className="mt-6 space-y-6">
          {!canCreateOffers && (
            <Card variant="elevated">
              <CardContent className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-amber-600">
                  <Boxes className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">Control de productos desactivado</p>
                    <p className="text-sm text-muted-foreground">
                      Activa el control de productos para crear ofertas sobre inventario.
                    </p>
                  </div>
                </div>
                <Button variant="outline" asChild className="w-fit">
                  <Link to="/admin/settings">Ir a configuración</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : isEmptyState ? (
            <EmptyState
              icon={BadgePercent}
              title="Sin ofertas aún"
              description={`Crea promociones para ${targetLabels[activeTarget].toLowerCase()} y destaca tu catálogo.`}
              action={canCreateOffers ? { label: 'Crear oferta', onClick: () => openOfferDialog() } : undefined}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers.map((offer) => (
                <Card key={offer.id} variant="elevated" className="h-full">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{offer.name}</h3>
                        {offer.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openOfferDialog(offer)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(offer.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {offer.discountType === 'percentage'
                          ? `-${offer.discountValue}%`
                          : `-${Number(offer.discountValue).toFixed(2)}€`}
                      </Badge>
                      <Badge variant="outline">{scopeLabels[offer.scope]}</Badge>
                      <Badge variant={offer.active ? 'default' : 'outline'}>
                        {offer.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-primary" />
                        <span>{offerSummary(offer)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>
                          {formatDate(offer.startDate)} → {formatDate(offer.endDate)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOffer ? 'Editar oferta' : `Nueva oferta de ${targetLabels[activeTarget].toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="offer-name">Nombre</Label>
                <Input
                  id="offer-name"
                  value={offerForm.name}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ej: Semana premium"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="offer-description">Descripción</Label>
                <Textarea
                  id="offer-description"
                  value={offerForm.description}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Describe cuándo aplica esta oferta."
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de descuento</Label>
                <Select
                  value={offerForm.discountType}
                  onValueChange={(value) => setOfferForm((prev) => ({ ...prev, discountType: value as Offer['discountType'] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje</SelectItem>
                    <SelectItem value="amount">Importe fijo</SelectItem>
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
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                  placeholder={offerForm.discountType === 'percentage' ? '10' : '5'}
                />
              </div>
              <div className="space-y-2">
                <Label>Alcance</Label>
                <Select
                  value={offerForm.scope}
                  onValueChange={(value) => setOfferForm((prev) => ({ ...prev, scope: value as OfferScope }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((scope) => (
                      <SelectItem key={scope} value={scope} disabled={scope === 'categories' && !categoriesEnabled}>
                        {scopeLabels[scope]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!categoriesEnabled && offerForm.scope === 'categories' && (
                  <p className="text-xs text-muted-foreground">
                    Activa las categorías en configuración para usar este alcance.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Oferta activa</p>
                    <p className="text-xs text-muted-foreground">Se aplicará dentro del rango indicado.</p>
                  </div>
                  <Switch
                    checked={offerForm.active}
                    onCheckedChange={(checked) => setOfferForm((prev) => ({ ...prev, active: checked }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="date"
                  value={offerForm.startDate}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input
                  type="date"
                  value={offerForm.endDate}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
              {offerForm.scope === 'categories' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Categorías incluidas</Label>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto rounded-xl border border-border p-4">
                    {currentCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay categorías disponibles.</p>
                    ) : (
                      currentCategories.map((category) => (
                        <label key={category.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={activeTarget === 'service'
                              ? offerForm.categoryIds.includes(category.id)
                              : offerForm.productCategoryIds.includes(category.id)}
                            onCheckedChange={() => {
                              setOfferForm((prev) => ({
                                ...prev,
                                categoryIds: activeTarget === 'service'
                                  ? toggleSelection(category.id, prev.categoryIds)
                                  : prev.categoryIds,
                                productCategoryIds: activeTarget === 'product'
                                  ? toggleSelection(category.id, prev.productCategoryIds)
                                  : prev.productCategoryIds,
                              }));
                            }}
                          />
                          <span>{category.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              {offerForm.scope === 'services' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Servicios incluidos</Label>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto rounded-xl border border-border p-4">
                    {orderedServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay servicios disponibles.</p>
                    ) : (
                      orderedServices.map((service) => (
                        <label key={service.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={offerForm.serviceIds.includes(service.id)}
                            onCheckedChange={() => {
                              setOfferForm((prev) => ({
                                ...prev,
                                serviceIds: toggleSelection(service.id, prev.serviceIds),
                              }));
                            }}
                          />
                          <span>{service.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              {offerForm.scope === 'products' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Productos incluidos</Label>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto rounded-xl border border-border p-4">
                    {orderedProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay productos disponibles.</p>
                    ) : (
                      orderedProducts.map((product) => (
                        <label key={product.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={offerForm.productIds.includes(product.id)}
                            onCheckedChange={() => {
                              setOfferForm((prev) => ({
                                ...prev,
                                productIds: toggleSelection(product.id, prev.productIds),
                              }));
                            }}
                          />
                          <span>{product.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar oferta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar oferta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. La oferta dejará de aplicarse inmediatamente.
          </p>
          <DialogFooter>
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

export default AdminOffers;
