import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useBusinessCopy } from '@/lib/businessCopy';
import {
  createProduct,
  deleteProduct,
  importProducts,
  updateProduct,
} from '@/data/api/products';
import {
  createProductCategory,
  deleteProductCategory,
  updateProductCategory,
} from '@/data/api/product-categories';
import { updateSiteSettings } from '@/data/api/settings';
import { Product, ProductCategory } from '@/data/types';
import { uploadToImageKit, deleteFromImageKit } from '@/lib/imagekit';
import { Boxes, ImagePlus, Loader2, PackagePlus, Pencil, RefreshCw, Trash2, Sparkles, CheckCircle2, GripVertical } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { fetchAdminProductsCached, fetchProductCategoriesCached } from '@/lib/catalogQuery';
import { dispatchProductsUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_PRODUCT_CATEGORIES: ProductCategory[] = [];
const UNCATEGORIZED_VALUE = 'none';
const PRODUCT_DRAG_MIME = 'application/x-product-id';
const CATEGORY_DRAG_MIME = 'application/x-product-category-id';

const reorderByInsertIndex = <T,>(items: T[], fromIndex: number, insertIndex: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  let targetIndex = insertIndex;
  if (fromIndex < insertIndex) {
    targetIndex -= 1;
  }
  if (targetIndex < 0) targetIndex = 0;
  if (targetIndex > next.length) targetIndex = next.length;
  next.splice(targetIndex, 0, moved);
  return next;
};

const sortProducts = (a: Product, b: Product) =>
  (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name);

const AdminStock: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const { locations, currentLocationId, tenant } = useTenant();
  const copy = useBusinessCopy();
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
    categoryId: UNCATEGORIZED_VALUE,
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
  const [isPersistingCategoryOrder, setIsPersistingCategoryOrder] = useState(false);
  const [isPersistingProductOrder, setIsPersistingProductOrder] = useState(false);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [dragOverCategoryPosition, setDragOverCategoryPosition] = useState<'before' | 'after'>('before');
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [dragOverProductColumnId, setDragOverProductColumnId] = useState<string | null>(null);
  const [dragOverProductPosition, setDragOverProductPosition] = useState<'before' | 'after'>('before');

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
      title: t('admin.common.error'),
      description: t('admin.stock.toast.loadInventoryError'),
      variant: 'destructive',
    });
  }, [categoriesQuery.error, productsQuery.error, settingsQuery.error, t, toast]);

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
  const orderedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [categories],
  );
  const orderedProducts = useMemo(
    () => [...products].sort(sortProducts),
    [products],
  );
  const productColumns = useMemo(() => {
    if (!categoriesEnabled) {
      return [
        {
          id: UNCATEGORIZED_VALUE,
          name: t('admin.stock.tabs.products'),
          description: t('admin.stock.subtitle', { locationSingularLower: copy.location.singularLower }),
          products: orderedProducts,
          isUncategorized: true,
        },
      ];
    }

    const baseColumns = orderedCategories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || t('admin.services.categories.noDescription'),
      products: orderedProducts.filter((product) => product.categoryId === category.id),
      isUncategorized: false,
    }));

    if (uncategorizedProducts.length > 0) {
      baseColumns.push({
        id: UNCATEGORIZED_VALUE,
        name: t('admin.services.uncategorized'),
        description: t('admin.stock.presentation.uncategorizedWarning', { count: uncategorizedProducts.length }),
        products: uncategorizedProducts,
        isUncategorized: true,
      });
    }

    return baseColumns;
  }, [
    categoriesEnabled,
    copy.location.singularLower,
    orderedCategories,
    orderedProducts,
    t,
    uncategorizedProducts,
  ]);

  const handleToggleCategories = async (enabled: boolean) => {
    if (!settings) return;
    if (!productsEnabled) return;
    if (enabled && uncategorizedProducts.length > 0) {
      toast({
        title: t('admin.stock.toast.assignCategoriesTitle'),
        description: t('admin.stock.toast.assignCategoriesDescription'),
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
        title: t('admin.stock.toast.preferencesUpdatedTitle'),
        description: enabled
          ? t('admin.stock.toast.categoriesEnabledDescription')
          : t('admin.stock.toast.categoriesDisabledDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.updateCategorizationError'),
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
        categoryId: product.categoryId ?? UNCATEGORIZED_VALUE,
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
        categoryId: categoriesEnabled ? orderedCategories[0]?.id ?? UNCATEGORIZED_VALUE : UNCATEGORIZED_VALUE,
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
      toast({
        title: t('admin.stock.toast.requiredProductNameTitle'),
        description: t('admin.stock.toast.requiredProductNameDescription'),
        variant: 'destructive',
      });
      return;
    }
    const priceValue = Number(productForm.price.replace(',', '.'));
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast({
        title: t('admin.stock.toast.invalidPriceTitle'),
        description: t('admin.stock.toast.invalidPriceDescription'),
        variant: 'destructive',
      });
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
        categoryId: productForm.categoryId === UNCATEGORIZED_VALUE ? null : productForm.categoryId,
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
      toast({
        title: t('admin.stock.toast.productSavedTitle'),
        description: t('admin.stock.toast.productSavedDescription'),
      });
      setIsProductDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.saveProductError'),
        variant: 'destructive',
      });
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
      toast({ title: t('admin.stock.toast.productDeletedTitle') });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.deleteProductError'),
        variant: 'destructive',
      });
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
      setCategoryForm({ name: '', description: '', position: categories.length });
    }
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({
        title: t('admin.stock.toast.requiredCategoryNameTitle'),
        description: t('admin.stock.toast.requiredCategoryNameDescription'),
        variant: 'destructive',
      });
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
      toast({ title: t('admin.stock.toast.categorySavedTitle') });
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.saveCategoryError'),
        variant: 'destructive',
      });
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
      toast({ title: t('admin.stock.toast.categoryDeletedTitle') });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.deleteCategoryError'),
        variant: 'destructive',
      });
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
        title: t('admin.stock.toast.importCompletedTitle'),
        description: t('admin.stock.toast.importCompletedDescription', {
          created: result.created,
          updated: result.updated,
        }),
      });
      dispatchProductsUpdated({ source: 'admin-stock' });
      setIsImportDialogOpen(false);
      await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.importError'),
        variant: 'destructive',
      });
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
      const id = product.categoryId ?? UNCATEGORIZED_VALUE;
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  const buildProductBuckets = (currentProducts: Product[]) => {
    const sorted = [...currentProducts].sort(sortProducts);
    const buckets = new Map<string, Product[]>();

    if (!categoriesEnabled) {
      buckets.set(UNCATEGORIZED_VALUE, sorted);
      return buckets;
    }

    orderedCategories.forEach((category) => buckets.set(category.id, []));
    sorted.forEach((product) => {
      const key = product.categoryId ?? UNCATEGORIZED_VALUE;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)?.push(product);
    });
    return buckets;
  };

  const resetDragState = () => {
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
    setDragOverCategoryPosition('before');
    setDraggingProductId(null);
    setDragOverProductId(null);
    setDragOverProductColumnId(null);
    setDragOverProductPosition('before');
  };

  const persistCategoryOrder = async (nextCategories: ProductCategory[]) => {
    const updates = nextCategories
      .map((category, index) => ({
        id: category.id,
        nextPosition: index,
        currentPosition: category.position ?? 0,
      }))
      .filter((entry) => entry.currentPosition !== entry.nextPosition)
      .map((entry) => updateProductCategory(entry.id, { position: entry.nextPosition }));

    if (updates.length === 0) return;

    setIsPersistingCategoryOrder(true);
    try {
      await Promise.all(updates);
      await Promise.all([categoriesQuery.refetch(), productsQuery.refetch()]);
      dispatchProductsUpdated({ source: 'admin-stock' });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.saveCategoryError'),
        variant: 'destructive',
      });
    } finally {
      setIsPersistingCategoryOrder(false);
    }
  };

  const persistProductDrop = async (productId: string, targetColumnId: string, targetIndex: number) => {
    const sourceProduct = products.find((product) => product.id === productId);
    if (!sourceProduct) return;

    if (categoriesEnabled && targetColumnId === UNCATEGORIZED_VALUE) {
      toast({
        title: t('admin.services.toast.missingCategoryTitle'),
        description: t('admin.services.toast.assignCategoryDescription'),
        variant: 'destructive',
      });
      return;
    }

    const sourceColumnId = categoriesEnabled
      ? (sourceProduct.categoryId ?? UNCATEGORIZED_VALUE)
      : UNCATEGORIZED_VALUE;
    const buckets = buildProductBuckets(products);
    const sourceBucket = buckets.get(sourceColumnId) ?? [];
    const sourceIndex = sourceBucket.findIndex((product) => product.id === productId);
    if (sourceIndex < 0) return;

    const [movingProduct] = sourceBucket.splice(sourceIndex, 1);
    const targetBucket = buckets.get(targetColumnId) ?? [];
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetBucket.length));
    const normalizedTargetIndex =
      sourceColumnId === targetColumnId && sourceIndex < boundedTargetIndex
        ? boundedTargetIndex - 1
        : boundedTargetIndex;
    targetBucket.splice(normalizedTargetIndex, 0, movingProduct);

    if (!buckets.has(targetColumnId)) {
      buckets.set(targetColumnId, targetBucket);
    }

    const touchedColumns = new Set([sourceColumnId, targetColumnId]);
    const updates: Array<Promise<unknown>> = [];
    touchedColumns.forEach((columnId) => {
      const columnProducts = buckets.get(columnId) ?? [];
      columnProducts.forEach((product, index) => {
        const nextCategoryId = categoriesEnabled
          ? (columnId === UNCATEGORIZED_VALUE ? null : columnId)
          : product.categoryId ?? null;
        if (categoriesEnabled && nextCategoryId === null) {
          return;
        }
        const currentCategoryId = product.categoryId ?? null;
        const currentPosition = product.position ?? 0;
        const categoryChanged = nextCategoryId !== currentCategoryId;
        const positionChanged = index !== currentPosition;
        if (categoryChanged || positionChanged) {
          const payload: Partial<Product> = { position: index };
          if (categoryChanged) {
            payload.categoryId = nextCategoryId;
          }
          updates.push(updateProduct(product.id, payload));
        }
      });
    });

    if (updates.length === 0) return;

    setIsPersistingProductOrder(true);
    try {
      await Promise.all(updates);
      await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
      dispatchProductsUpdated({ source: 'admin-stock' });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.stock.toast.saveProductError'),
        variant: 'destructive',
      });
    } finally {
      setIsPersistingProductOrder(false);
    }
  };

  const handleCategoryDragStart = (event: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    if (isPersistingCategoryOrder || isPersistingProductOrder) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CATEGORY_DRAG_MIME, categoryId);
    event.dataTransfer.setData('text/plain', categoryId);
    setDraggingCategoryId(categoryId);
    setDragOverCategoryId(categoryId);
  };

  const handleCategoryDragOver = (event: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    event.preventDefault();
    if (!draggingCategoryId) return;
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const middleY = bounds.top + bounds.height / 2;
    setDragOverCategoryPosition(event.clientY <= middleY ? 'before' : 'after');
    setDragOverCategoryId(categoryId);
  };

  const handleCategoryDrop = async (event: React.DragEvent<HTMLDivElement>, targetCategoryId: string) => {
    event.preventDefault();
    const sourceCategoryId =
      event.dataTransfer.getData(CATEGORY_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    if (!sourceCategoryId || sourceCategoryId === targetCategoryId) {
      resetDragState();
      return;
    }

    const fromIndex = orderedCategories.findIndex((category) => category.id === sourceCategoryId);
    const toIndex = orderedCategories.findIndex((category) => category.id === targetCategoryId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      resetDragState();
      return;
    }

    const insertIndex = toIndex + (dragOverCategoryPosition === 'after' ? 1 : 0);
    await persistCategoryOrder(reorderByInsertIndex(orderedCategories, fromIndex, insertIndex));
    resetDragState();
  };

  const handleProductDragStart = (event: React.DragEvent<HTMLDivElement>, productId: string) => {
    if (isPersistingCategoryOrder || isPersistingProductOrder) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(PRODUCT_DRAG_MIME, productId);
    event.dataTransfer.setData('text/plain', productId);
    setDraggingProductId(productId);
    setDragOverProductId(productId);
  };

  const handleProductDragOverColumn = (event: React.DragEvent<HTMLDivElement>, columnId: string) => {
    event.preventDefault();
    if (!draggingProductId) return;
    event.dataTransfer.dropEffect = 'move';
    setDragOverProductColumnId(columnId);
    setDragOverProductId(null);
    setDragOverProductPosition('after');
  };

  const handleProductDragOverCard = (
    event: React.DragEvent<HTMLDivElement>,
    columnId: string,
    productId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingProductId) return;
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const middleY = bounds.top + bounds.height / 2;
    setDragOverProductPosition(event.clientY <= middleY ? 'before' : 'after');
    setDragOverProductColumnId(columnId);
    setDragOverProductId(productId);
  };

  const handleProductDropAtColumnEnd = async (
    event: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    event.preventDefault();
    const productId = event.dataTransfer.getData(PRODUCT_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    if (!productId) {
      resetDragState();
      return;
    }
    const targetColumn = productColumns.find((column) => column.id === columnId);
    await persistProductDrop(productId, columnId, targetColumn?.products.length ?? 0);
    resetDragState();
  };

  const handleProductDropBeforeCard = async (
    event: React.DragEvent<HTMLDivElement>,
    columnId: string,
    targetProductId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const productId = event.dataTransfer.getData(PRODUCT_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    if (!productId) {
      resetDragState();
      return;
    }

    const targetColumn = productColumns.find((column) => column.id === columnId);
    const targetIndex = targetColumn?.products.findIndex((product) => product.id === targetProductId) ?? -1;
    const insertIndex = targetIndex + (dragOverProductPosition === 'after' ? 1 : 0);
    await persistProductDrop(productId, columnId, insertIndex >= 0 ? insertIndex : 0);
    resetDragState();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-2xl font-bold text-foreground">{t('admin.stock.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.stock.subtitle', { locationSingularLower: copy.location.singularLower })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openImportDialog} disabled={locations.length <= 1 || !productsEnabled}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('admin.stock.actions.importProducts')}
          </Button>
          <Button onClick={() => openProductDialog()} disabled={!productsEnabled}>
            <PackagePlus className="w-4 h-4 mr-2" />
            {t('admin.stock.actions.newProduct')}
          </Button>
        </div>
      </div>

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
                <p className="text-sm font-medium text-foreground">{t('admin.stock.presentation.groupByCategories')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.stock.presentation.groupByCategoriesDescription')}
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
                  {t('admin.stock.presentation.categorizationActive')}
                </div>
                <p className="mt-2">
                  {t('admin.stock.presentation.categorizationActiveDescription')}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                {t('admin.stock.presentation.simpleListDescription')}
              </div>
            )}
            {uncategorizedProducts.length > 0 && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                {t('admin.stock.presentation.uncategorizedWarning', { count: uncategorizedProducts.length })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-2 gap-4">
          {[
            { label: t('admin.stock.summary.activeProducts'), value: inventorySummary.activeCount },
            { label: t('admin.stock.summary.stockUnits'), value: inventorySummary.totalStock },
            { label: t('admin.stock.summary.lowStock'), value: inventorySummary.lowStock },
            { label: t('admin.stock.summary.inventoryValue'), value: `${inventorySummary.inventoryValue.toFixed(2)}€` },
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
          <TabsTrigger value="products">{t('admin.stock.tabs.products')}</TabsTrigger>
          <TabsTrigger value="categories">{t('admin.stock.tabs.categories')}</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-primary" />
                {t('admin.stock.inventoryTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">{t('admin.stock.loadingInventory')}</div>
              ) : products.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t('admin.spotlight.dragToReorder')}</p>
                    {(isPersistingCategoryOrder || isPersistingProductOrder) && (
                      <div className="inline-flex items-center gap-2 text-xs text-primary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('admin.common.saving')}
                      </div>
                    )}
                  </div>
                  <div className={cn('pb-2', categoriesEnabled ? 'flex gap-4 overflow-x-auto' : 'block')}>
                    {productColumns.map((column) => {
                      const isColumnDragOver =
                        dragOverProductColumnId === column.id && !dragOverProductId;
                      return (
                        <Card
                          key={column.id}
                          variant="elevated"
                          className={cn(
                            categoriesEnabled
                              ? 'w-[320px] min-w-[320px] max-w-[320px] shrink-0'
                              : 'w-full min-w-0 max-w-none',
                            'border border-border/70 bg-background/70',
                            isColumnDragOver && 'ring-2 ring-primary/30 border-primary/40',
                          )}
                        >
                          <CardHeader className="space-y-1">
                            <CardTitle className="text-base flex items-center justify-between gap-2">
                              <span className="truncate">{column.name}</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                {t('admin.stock.categories.productCount', { count: column.products.length })}
                              </span>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground line-clamp-2">{column.description}</p>
                          </CardHeader>
                          <CardContent
                            className={cn(
                              'relative min-h-[220px]',
                              categoriesEnabled
                                ? 'space-y-2'
                                : 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 content-start',
                            )}
                            onDragOver={(event) => handleProductDragOverColumn(event, column.id)}
                            onDrop={(event) => void handleProductDropAtColumnEnd(event, column.id)}
                          >
                            {isColumnDragOver && (
                              <span className="pointer-events-none absolute bottom-1 left-3 right-3 h-[2px] rounded-full bg-primary" />
                            )}
                            {column.products.map((product) => {
                              const hasOffer =
                                product.finalPrice !== undefined &&
                                Math.abs(product.finalPrice - product.price) > 0.001;
                              const isLow = product.stock <= (product.minStock ?? 0);
                              const isProductDragging = draggingProductId === product.id;
                              const isProductDropTarget =
                                dragOverProductId === product.id && draggingProductId !== product.id;
                              return (
                                <div
                                  key={product.id}
                                  draggable={!isPersistingCategoryOrder && !isPersistingProductOrder}
                                  onDragStart={(event) => handleProductDragStart(event, product.id)}
                                  onDragOver={(event) => handleProductDragOverCard(event, column.id, product.id)}
                                  onDrop={(event) => void handleProductDropBeforeCard(event, column.id, product.id)}
                                  onDragEnd={resetDragState}
                                  className={cn(
                                    'relative rounded-xl border border-border bg-card/70 p-3 space-y-2 transition-all duration-150 cursor-grab active:cursor-grabbing select-none',
                                    isProductDragging &&
                                      'bg-primary/10 border-primary/40 shadow-md scale-[0.99] opacity-80',
                                    isProductDropTarget && 'ring-2 ring-primary/30 border-primary/40',
                                  )}
                                >
                                  {isProductDropTarget && dragOverProductPosition === 'before' && (
                                    <span className="pointer-events-none absolute -top-[1px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                                  )}
                                  {isProductDropTarget && dragOverProductPosition === 'after' && (
                                    <span className="pointer-events-none absolute -bottom-[1px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                                  )}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 min-w-0">
                                      <GripVertical
                                        className={cn(
                                          'w-4 h-4 mt-0.5 shrink-0',
                                          isProductDragging ? 'text-primary' : 'text-muted-foreground',
                                        )}
                                      />
                                      <div className="w-10 h-10 rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center shrink-0">
                                        {product.imageUrl ? (
                                          <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            loading="lazy"
                                            decoding="async"
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground">{t('admin.stock.noPhoto')}</span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)}>
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => setDeleteProductId(product.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="ml-6 flex items-center gap-2 text-[11px]">
                                    <Badge
                                      variant="outline"
                                      className={product.isActive
                                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600'
                                        : 'border-rose-500/30 bg-rose-500/15 text-rose-500'}
                                    >
                                      {product.isActive ? t('admin.stock.status.active') : t('admin.stock.status.inactive')}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={product.isPublic
                                        ? 'border-sky-500/30 bg-sky-500/15 text-sky-600'
                                        : 'border-slate-500/30 bg-slate-500/15 text-slate-500'}
                                    >
                                      {product.isPublic ? t('admin.stock.status.visible') : t('admin.stock.status.private')}
                                    </Badge>
                                    {isLow && <Badge variant="destructive">{t('admin.stock.status.lowStock')}</Badge>}
                                  </div>
                                  <div className="ml-6 flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">
                                      {t('admin.stock.fields.stock')}: {product.stock}
                                    </div>
                                    <div className="text-right">
                                      {hasOffer && (
                                        <div className="text-[11px] line-through text-muted-foreground">
                                          {product.price.toFixed(2)}€
                                        </div>
                                      )}
                                      <span className="text-lg font-bold text-primary">
                                        {(product.finalPrice ?? product.price).toFixed(2)}€
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {column.products.length === 0 && (
                              <div
                                className={cn(
                                  'rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground',
                                  !categoriesEnabled && 'col-span-full',
                                )}
                              >
                                {t('admin.stock.emptyProductsTitle')}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title={t('admin.stock.emptyProductsTitle')}
                  description={t('admin.stock.emptyProductsDescription')}
                  action={productsEnabled ? { label: t('admin.stock.actions.newProduct'), onClick: () => openProductDialog() } : undefined}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card variant="elevated">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{t('admin.stock.categoriesTitle')}</CardTitle>
              <Button variant="outline" onClick={() => openCategoryDialog()} disabled={!productsEnabled}>
                {t('admin.services.actions.newCategory')}
              </Button>
            </CardHeader>
            <CardContent>
              {orderedCategories.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t('admin.spotlight.dragToReorder')}</p>
                    {(isPersistingCategoryOrder || isPersistingProductOrder) && (
                      <div className="inline-flex items-center gap-2 text-xs text-primary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('admin.common.saving')}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,360px))] gap-3">
                    {orderedCategories.map((category) => {
                      const count = categoryCounts[category.id] ?? 0;
                      const isDragging = draggingCategoryId === category.id;
                      const isDragOver = dragOverCategoryId === category.id && draggingCategoryId !== category.id;
                      return (
                        <div
                          key={category.id}
                          draggable={!isPersistingCategoryOrder && !isPersistingProductOrder}
                          onDragStart={(event) => handleCategoryDragStart(event, category.id)}
                          onDragOver={(event) => handleCategoryDragOver(event, category.id)}
                          onDrop={(event) => void handleCategoryDrop(event, category.id)}
                          onDragEnd={resetDragState}
                          className={cn(
                            'relative rounded-xl border border-border p-4 bg-background/60 flex items-start justify-between gap-3 transition-all duration-200 cursor-grab active:cursor-grabbing select-none',
                            isDragging && 'bg-primary/10 border-primary/40 shadow-lg scale-[0.99]',
                            isDragOver && 'ring-2 ring-primary/30 bg-primary/5',
                          )}
                        >
                          {isDragOver && dragOverCategoryPosition === 'before' && (
                            <span className="pointer-events-none absolute -top-[1px] left-3 right-3 h-[2px] rounded-full bg-primary" />
                          )}
                          {isDragOver && dragOverCategoryPosition === 'after' && (
                            <span className="pointer-events-none absolute -bottom-[1px] left-3 right-3 h-[2px] rounded-full bg-primary" />
                          )}
                          <div className="flex items-start gap-3">
                            <GripVertical className={cn('w-4 h-4 mt-0.5', isDragging ? 'text-primary' : 'text-muted-foreground')} />
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground">{category.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {category.description || t('admin.services.categories.noDescription')}
                              </p>
                              <span className="text-[11px] text-muted-foreground">
                                {t('admin.stock.categories.productCount', { count })}
                              </span>
                            </div>
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
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title={t('admin.services.categories.emptyTitle')}
                  description={t('admin.services.categories.emptyDescription')}
                  action={productsEnabled ? { label: t('admin.services.actions.newCategory'), onClick: () => openCategoryDialog() } : undefined}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? t('admin.stock.dialog.editProductTitle') : t('admin.stock.dialog.newProductTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.stock.dialog.productDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t('admin.services.fields.name')}</Label>
                  <InlineTranslationPopover
                    entityType="product"
                    entityId={editingProduct?.id}
                    fieldKey="name"
                    onUpdated={async () => {
                      await productsQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t('admin.stock.fields.productNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.stock.fields.skuOptional')}</Label>
                <Input
                  value={productForm.sku}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder={t('admin.stock.fields.skuPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.services.fields.description')}</Label>
                <InlineTranslationPopover
                  entityType="product"
                  entityId={editingProduct?.id}
                  fieldKey="description"
                  onUpdated={async () => {
                    await productsQuery.refetch();
                  }}
                />
              </div>
              <Input
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('admin.stock.fields.descriptionPlaceholder')}
                required={false}
              />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.services.fields.price')}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={productForm.price}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.stock.fields.stock')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={productForm.stock}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, stock: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.stock.fields.minStock')}</Label>
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
                <Label>{t('admin.services.fields.category')}</Label>
                <Select
                  value={productForm.categoryId}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.services.fields.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {!categoriesEnabled && (
                      <SelectItem value={UNCATEGORIZED_VALUE}>{t('admin.services.uncategorized')}</SelectItem>
                    )}
                    {orderedCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoriesEnabled && orderedCategories.length === 0 && (
                  <p className="text-xs text-destructive">{t('admin.services.fields.createCategoryFirst')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('admin.stock.fields.image')}</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer text-sm text-muted-foreground">
                    <ImagePlus className="w-4 h-4" />
                    {t('admin.stock.actions.uploadImage')}
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
                      alt={t('admin.stock.fields.previewAlt')}
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
                <span className="text-sm">{t('admin.stock.fields.productActive')}</span>
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) => setProductForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <span className="text-sm">{t('admin.stock.fields.visibleForClients')}</span>
                <Switch
                  checked={productForm.isPublic}
                  onCheckedChange={(checked) => setProductForm((prev) => ({ ...prev, isPublic: checked }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>
              {t('appointmentEditor.cancel')}
            </Button>
            <Button onClick={handleSaveProduct} disabled={isProductSaving}>
              {isProductSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProduct ? t('admin.services.actions.saveChanges') : t('admin.stock.actions.createProduct')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('admin.services.dialog.editCategoryTitle') : t('admin.services.dialog.newCategoryTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.stock.dialog.categoryDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.services.fields.name')}</Label>
                <InlineTranslationPopover
                  entityType="product_category"
                  entityId={editingCategory?.id}
                  fieldKey="name"
                  onUpdated={async () => {
                    await categoriesQuery.refetch();
                  }}
                />
              </div>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('admin.services.fields.description')}</Label>
                <InlineTranslationPopover
                  entityType="product_category"
                  entityId={editingCategory?.id}
                  fieldKey="description"
                  onUpdated={async () => {
                    await categoriesQuery.refetch();
                  }}
                />
              </div>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              {t('appointmentEditor.cancel')}
            </Button>
            <Button onClick={handleSaveCategory} disabled={isCategorySaving}>
              {isCategorySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCategory ? t('admin.services.actions.saveChanges') : t('admin.services.actions.createCategory')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProductId} onOpenChange={(open) => !open && setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.stock.deleteProductDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.stock.deleteProductDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.stock.deleteCategoryDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.stock.deleteCategoryDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.stock.importDialog.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.stock.importDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.stock.importDialog.sourceLabel', { locationFromWithDefinite: copy.location.fromWithDefinite })}</Label>
              <Select value={importSourceLocalId} onValueChange={setImportSourceLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.stock.importDialog.selectLocation', { locationIndefiniteSingular: copy.location.indefiniteSingular })} />
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
              <Label>{t('admin.stock.importDialog.targetLabel', { locationFromWithDefinite: copy.location.fromWithDefinite })}</Label>
              <Select value={importTargetLocalId} onValueChange={setImportTargetLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.stock.importDialog.selectLocation', { locationIndefiniteSingular: copy.location.indefiniteSingular })} />
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
              {t('admin.stock.importDialog.requirements', { locationDefiniteSingular: copy.location.definiteSingular })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {t('appointmentEditor.cancel')}
            </Button>
            <Button onClick={handleImport} disabled={isImporting || !importSourceLocalId || !importTargetLocalId}>
              {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('admin.stock.actions.importNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminStock;
