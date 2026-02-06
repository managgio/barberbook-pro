import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useBusinessCopy } from '@/lib/businessCopy';
import {
  createProduct,
  createProductCategory,
  deleteProduct,
  deleteProductCategory,
  updateSiteSettings,
  importProducts,
  updateProduct,
  updateProductCategory,
} from '@/data/api';
import { Product, ProductCategory } from '@/data/types';
import { uploadToImageKit, deleteFromImageKit } from '@/lib/imagekit';
import { Boxes, ImagePlus, Info, Loader2, PackagePlus, Pencil, RefreshCw, Trash2, Sparkles, CheckCircle2 } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { fetchAdminProductsCached, fetchProductCategoriesCached } from '@/lib/catalogQuery';
import { dispatchProductsUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_PRODUCT_CATEGORIES: ProductCategory[] = [];

const AdminStock: React.FC = () => {
  const { toast } = useToast();
  const { locations, currentLocationId, tenant } = useTenant();
  const copy = useBusinessCopy();
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showPublicOnly, setShowPublicOnly] = useState(false);

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    stock: '',
    minStock: '',
    categoryId: 'none',
    imageUrl: '',
    imageFileId: '',
    isActive: true,
    isPublic: true,
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    position: 0,
  });

  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importSourceLocalId, setImportSourceLocalId] = useState<string>('');
  const [importTargetLocalId, setImportTargetLocalId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettings(currentLocationId),
    queryFn: () => fetchSiteSettingsCached(currentLocationId),
  });
  const productsQuery = useQuery({
    queryKey: queryKeys.adminProducts(currentLocationId),
    queryFn: () => fetchAdminProductsCached({ localId: currentLocationId }),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.productCategories(currentLocationId),
    queryFn: () => fetchProductCategoriesCached({ localId: currentLocationId }),
  });
  const settings = settingsQuery.data ?? null;
  const products = useMemo(
    () => productsQuery.data ?? EMPTY_PRODUCTS,
    [productsQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? EMPTY_PRODUCT_CATEGORIES,
    [categoriesQuery.data],
  );
  const isLoading = settingsQuery.isLoading || productsQuery.isLoading || categoriesQuery.isLoading;

  const productsEnabled = !(tenant?.config?.adminSidebar?.hiddenSections ?? []).includes('stock');
  const categoriesEnabled = settings?.products.categoriesEnabled ?? false;
  useEffect(() => {
    if (!settingsQuery.error && !productsQuery.error && !categoriesQuery.error) return;
    toast({
      title: 'Error',
      description: 'No se pudo cargar el inventario.',
      variant: 'destructive',
    });
  }, [categoriesQuery.error, productsQuery.error, settingsQuery.error, toast]);

  useEffect(() => {
    if (!productImageFile) {
      setProductImagePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(productImageFile);
    setProductImagePreview(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [productImageFile]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter !== 'all' && product.categoryId !== categoryFilter) return false;
      if (showActiveOnly && !product.isActive) return false;
      if (showPublicOnly && !product.isPublic) return false;
      if (!query) return true;
      const haystack = `${product.name} ${product.description ?? ''} ${product.sku ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [products, search, categoryFilter, showActiveOnly, showPublicOnly]);

  const inventorySummary = useMemo(() => {
    const activeCount = products.filter((product) => product.isActive).length;
    const totalStock = products.reduce((acc, product) => acc + product.stock, 0);
    const lowStock = products.filter((product) => product.stock <= (product.minStock ?? 0)).length;
    const inventoryValue = products.reduce((acc, product) => acc + product.stock * product.price, 0);
    return { activeCount, totalStock, lowStock, inventoryValue };
  }, [products]);

  const uncategorizedProducts = useMemo(
    () => products.filter((product) => !product.categoryId),
    [products],
  );

  const handleToggleCategories = async (enabled: boolean) => {
    if (!settings) return;
    if (!productsEnabled) return;
    if (enabled && uncategorizedProducts.length > 0) {
      toast({
        title: 'Asigna categorías',
        description: 'Todos los productos deben tener categoría antes de activar la vista por familias.',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingSettings(true);
    try {
      const updated = await updateSiteSettings({
        ...settings,
        products: { ...settings.products, categoriesEnabled: enabled },
      });
      dispatchSiteSettingsUpdated(updated);
      toast({
        title: 'Preferencias actualizadas',
        description: enabled ? 'Las categorías están activas.' : 'Las categorías se han desactivado.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la categorización.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openProductDialog = (product?: Product) => {
    setEditingProduct(product || null);
    setProductImageFile(null);
    if (product) {
      setProductForm({
        name: product.name,
        description: product.description ?? '',
        sku: product.sku ?? '',
        price: product.price.toFixed(2),
        stock: String(product.stock),
        minStock: String(product.minStock ?? 0),
        categoryId: product.categoryId ?? 'none',
        imageUrl: product.imageUrl ?? '',
        imageFileId: product.imageFileId ?? '',
        isActive: product.isActive,
        isPublic: product.isPublic,
      });
    } else {
      setProductForm({
        name: '',
        description: '',
        sku: '',
        price: '',
        stock: '',
        minStock: '',
        categoryId: categoriesEnabled ? 'none' : 'none',
        imageUrl: '',
        imageFileId: '',
        isActive: true,
        isPublic: true,
      });
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast({ title: 'Nombre obligatorio', description: 'Indica el nombre del producto.', variant: 'destructive' });
      return;
    }
    const priceValue = Number(productForm.price.replace(',', '.'));
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast({ title: 'Precio inválido', description: 'Introduce un precio válido.', variant: 'destructive' });
      return;
    }
    const stockValue = Number(productForm.stock || 0);
    const minStockValue = Number(productForm.minStock || 0);
    setIsProductSaving(true);
    try {
      let imageUrl = productForm.imageUrl || null;
      let imageFileId = productForm.imageFileId || null;
      if (productImageFile) {
        const fileName = `product-${productForm.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        const uploaded = await uploadToImageKit(productImageFile, fileName, 'products');
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      }
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || '',
        sku: productForm.sku.trim() || null,
        price: priceValue,
        stock: Math.max(0, Math.floor(stockValue)),
        minStock: Math.max(0, Math.floor(minStockValue)),
        categoryId: productForm.categoryId === 'none' ? null : productForm.categoryId,
        imageUrl,
        imageFileId,
        isActive: productForm.isActive,
        isPublic: productForm.isPublic,
      };

      if (editingProduct) {
        const previousImageFileId = editingProduct.imageFileId;
        const updated = await updateProduct(editingProduct.id, payload);
        if (productImageFile && previousImageFileId && previousImageFileId !== updated.imageFileId) {
          await deleteFromImageKit(previousImageFileId);
        }
      } else {
        await createProduct(payload);
      }
      dispatchProductsUpdated({ source: 'admin-stock' });
      await productsQuery.refetch();
      toast({ title: 'Producto guardado', description: 'El inventario se actualizó.' });
      setIsProductDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el producto.', variant: 'destructive' });
    } finally {
      setIsProductSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductId) return;
    try {
      await deleteProduct(deleteProductId);
      dispatchProductsUpdated({ source: 'admin-stock' });
      await productsQuery.refetch();
      toast({ title: 'Producto eliminado' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el producto.', variant: 'destructive' });
    } finally {
      setDeleteProductId(null);
    }
  };

  const openCategoryDialog = (category?: ProductCategory) => {
    setEditingCategory(category || null);
    if (category) {
      setCategoryForm({
        name: category.name,
        description: category.description ?? '',
        position: category.position ?? 0,
      });
    } else {
      setCategoryForm({ name: '', description: '', position: 0 });
    }
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: 'Nombre obligatorio', description: 'Indica el nombre de la categoría.', variant: 'destructive' });
      return;
    }
    setIsCategorySaving(true);
    try {
      if (editingCategory) {
        await updateProductCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          position: categoryForm.position,
        });
      } else {
        await createProductCategory({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          position: categoryForm.position,
        });
      }
      dispatchProductsUpdated({ source: 'admin-stock' });
      await Promise.all([categoriesQuery.refetch(), productsQuery.refetch()]);
      toast({ title: 'Categoría guardada' });
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la categoría.', variant: 'destructive' });
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      await deleteProductCategory(deleteCategoryId);
      dispatchProductsUpdated({ source: 'admin-stock' });
      await Promise.all([categoriesQuery.refetch(), productsQuery.refetch()]);
      toast({ title: 'Categoría eliminada' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la categoría.', variant: 'destructive' });
    } finally {
      setDeleteCategoryId(null);
    }
  };

  const handleImport = async () => {
    if (!importSourceLocalId || !importTargetLocalId) return;
    setIsImporting(true);
    try {
      const result = await importProducts({ sourceLocalId: importSourceLocalId, targetLocalId: importTargetLocalId });
      toast({
        title: 'Importación completada',
        description: `${result.created} creados · ${result.updated} actualizados`,
      });
      dispatchProductsUpdated({ source: 'admin-stock' });
      setIsImportDialogOpen(false);
      await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo importar el catálogo.', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const openImportDialog = () => {
    const otherLocation = locations.find((loc) => loc.id !== currentLocationId);
    setImportSourceLocalId(otherLocation?.id || '');
    setImportTargetLocalId(currentLocationId || '');
    setIsImportDialogOpen(true);
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((product) => {
      const id = product.categoryId ?? 'none';
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-2xl font-bold text-foreground">Control de stock</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona el inventario y el catálogo de productos por {copy.location.singularLower}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openImportDialog} disabled={locations.length <= 1 || !productsEnabled}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Importar productos
          </Button>
          <Button onClick={() => openProductDialog()} disabled={!productsEnabled}>
            <PackagePlus className="w-4 h-4 mr-2" />
            Nuevo producto
          </Button>
        </div>
      </div>

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
                <p className="text-sm font-medium text-foreground">Agrupar por categorías</p>
                <p className="text-xs text-muted-foreground">
                  Ordena el catálogo para clientes y landing.
                </p>
              </div>
              <Switch
                checked={categoriesEnabled}
                disabled={!productsEnabled || isSavingSettings || isLoading}
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
                  Asegúrate de que todos los productos tengan categoría asignada.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                Los productos se muestran en una lista simple.
              </div>
            )}
            {uncategorizedProducts.length > 0 && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                Tienes {uncategorizedProducts.length} producto(s) sin categoría. Asígnalos para activar la vista agrupada.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-2 gap-4">
          {[
            { label: 'Productos activos', value: inventorySummary.activeCount },
            { label: 'Unidades en stock', value: inventorySummary.totalStock },
            { label: 'Bajo stock', value: inventorySummary.lowStock },
            { label: 'Valor inventario', value: `${inventorySummary.inventoryValue.toFixed(2)}€` },
          ].map((item) => (
            <Card key={item.label} variant="elevated" className="h-full">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
                <p className="text-2xl font-bold text-foreground">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card variant="elevated">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-primary" />
                Inventario
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Input
                    placeholder="Buscar producto"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[220px]"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={showActiveOnly ? 'secondary' : 'outline'}
                  onClick={() => setShowActiveOnly((prev) => !prev)}
                >
                  Activos
                </Button>
                <Button
                  variant={showPublicOnly ? 'secondary' : 'outline'}
                  onClick={() => setShowPublicOnly((prev) => !prev)}
                >
                  Visibles
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                    Activo: se puede usar en citas y en el catálogo interno. Visible: aparece en la landing/app para clientes.
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Cargando inventario...</div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => {
                    const hasOffer = product.finalPrice !== undefined && Math.abs(product.finalPrice - product.price) > 0.001;
                    const isLow = product.stock <= (product.minStock ?? 0);
                    return (
                      <Card key={product.id} className="border border-border/70 bg-background/70">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-muted/50 overflow-hidden flex items-center justify-center">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    loading="lazy"
                                    decoding="async"
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sin foto</span>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.category?.name || 'Sin categoría'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteProductId(product.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge
                              variant="outline"
                              className={product.isActive
                                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600'
                                : 'border-rose-500/30 bg-rose-500/15 text-rose-500'}
                            >
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={product.isPublic
                                ? 'border-sky-500/30 bg-sky-500/15 text-sky-600'
                                : 'border-slate-500/30 bg-slate-500/15 text-slate-500'}
                            >
                              {product.isPublic ? 'Visible' : 'Privado'}
                            </Badge>
                            {isLow && <Badge variant="destructive">Stock bajo</Badge>}
                          </div>
                          <div className="flex items-end justify-between">
                            <div className="text-sm">
                              <p className="text-xs text-muted-foreground">Stock</p>
                              <p className={cn('text-lg font-semibold', isLow ? 'text-destructive' : 'text-foreground')}>
                                {product.stock}
                              </p>
                            </div>
                            <div className="text-right">
                              {hasOffer && (
                                <p className="text-xs line-through text-muted-foreground">
                                  {product.price.toFixed(2)}€
                                </p>
                              )}
                              <p className="text-lg font-semibold text-primary">
                                {(product.finalPrice ?? product.price).toFixed(2)}€
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title="Sin productos"
                  description="Crea productos para empezar a controlar el stock."
                  action={productsEnabled ? { label: 'Nuevo producto', onClick: () => openProductDialog() } : undefined}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card variant="elevated">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Categorías de productos</CardTitle>
              <Button variant="outline" onClick={() => openCategoryDialog()} disabled={!productsEnabled}>
                Nueva categoría
              </Button>
            </CardHeader>
            <CardContent>
              {categories.length > 0 ? (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <Card key={category.id} className="border border-border/70 bg-background/70">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{category.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {category.description || 'Sin descripción'}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteCategoryId(category.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{categoryCounts[category.id] ?? 0} producto(s)</span>
                          <span className="px-2 py-1 rounded-full border border-border">
                            Orden {category.position ?? 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title="Sin categorías"
                  description="Crea categorías para organizar el catálogo."
                  action={productsEnabled ? { label: 'Nueva categoría', onClick: () => openCategoryDialog() } : undefined}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU (opcional)</Label>
                <Input
                  value={productForm.sku}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="SKU interno"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe el producto en una línea."
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={productForm.price}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={productForm.stock}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, stock: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  value={productForm.minStock}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, minStock: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={productForm.categoryId}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Imagen</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer text-sm text-muted-foreground">
                    <ImagePlus className="w-4 h-4" />
                    Subir imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setProductImageFile(file);
                      }}
                    />
                  </label>
                  {(productImagePreview || productForm.imageUrl) && (
                    <img
                      src={productImagePreview || productForm.imageUrl}
                      alt="Preview"
                      loading="lazy"
                      decoding="async"
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <span className="text-sm">Producto activo</span>
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) => setProductForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <span className="text-sm">Visible para clientes</span>
                <Switch
                  checked={productForm.isPublic}
                  onCheckedChange={(checked) => setProductForm((prev) => ({ ...prev, isPublic: checked }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct} disabled={isProductSaving}>
              {isProductSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProduct ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                min={0}
                value={categoryForm.position}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, position: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCategory} disabled={isCategorySaving}>
              {isCategorySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProductId} onOpenChange={(open) => !open && setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer y el producto dejará de estar disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Los productos quedarán sin categoría si están asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar productos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Origen {copy.location.fromWithDefinite}</Label>
              <Select value={importSourceLocalId} onValueChange={setImportSourceLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecciona ${copy.location.indefiniteSingular}`} />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter((loc) => loc.id !== importTargetLocalId).map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destino {copy.location.fromWithDefinite}</Label>
              <Select value={importTargetLocalId} onValueChange={setImportTargetLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecciona ${copy.location.indefiniteSingular}`} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Para completar la importación, {copy.location.definiteSingular} de destino debe tener habilitado el control de productos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={isImporting || !importSourceLocalId || !importTargetLocalId}>
              {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Importar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStock;
