import React, { useMemo, useState } from 'react';
import { Product, ProductCategory } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type SelectedProduct = { productId: string; quantity: number };

interface ProductSelectorProps {
  products: Product[];
  categories?: ProductCategory[];
  selected: SelectedProduct[];
  onChange: (items: SelectedProduct[]) => void;
  disabled?: boolean;
  showStock?: boolean;
  allowOverstock?: boolean;
  className?: string;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  categories = [],
  selected,
  onChange,
  disabled = false,
  showStock = true,
  allowOverstock = false,
  className,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const selectedMap = useMemo(
    () => new Map(selected.map((item) => [item.productId, item.quantity])),
    [selected],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter !== 'all' && product.categoryId !== categoryFilter) return false;
      if (!query) return true;
      const haystack = `${product.name} ${product.description ?? ''} ${product.sku ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [products, search, categoryFilter]);

  const updateQuantity = (productId: string, quantity: number) => {
    const next = selected.filter((item) => item.productId !== productId);
    if (quantity > 0) {
      next.push({ productId, quantity });
    }
    onChange(next);
  };

  const totalAmount = useMemo(() => {
    return selected.reduce((acc, item) => {
      const product = products.find((prod) => prod.id === item.productId);
      if (!product) return acc;
      const unitPrice = product.finalPrice ?? product.price;
      return acc + unitPrice * item.quantity;
    }, 0);
  }, [products, selected]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-60">
            <SelectValue placeholder="Categorías" />
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
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {filteredProducts.map((product) => {
          const quantity = selectedMap.get(product.id) ?? 0;
          const unitPrice = product.finalPrice ?? product.price;
          const hasOffer = product.finalPrice !== undefined && Math.abs(product.finalPrice - product.price) > 0.001;
          const isLowStock = showStock && product.stock <= (product.minStock ?? 0);
          const maxQuantity = allowOverstock ? Number.MAX_SAFE_INTEGER : product.stock;
          const canIncrease = quantity < maxQuantity;
          return (
            <div
              key={product.id}
              className={cn(
                'flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between',
                disabled && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-lg bg-muted/60 overflow-hidden flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin foto</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{product.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {hasOffer && (
                      <span className="line-through text-muted-foreground">{product.price.toFixed(2)}€</span>
                    )}
                    <span className="font-medium text-foreground">{unitPrice.toFixed(2)}€</span>
                    {product.category?.name && (
                      <span className="px-2 py-0.5 rounded-full border border-border text-[11px]">
                        {product.category.name}
                      </span>
                    )}
                    {showStock && (
                      <span className={cn('text-[11px]', isLowStock ? 'text-destructive' : 'text-muted-foreground')}>
                        Stock: {product.stock}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(product.id, Math.max(0, quantity - 1))}
                  disabled={disabled || quantity === 0}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={allowOverstock ? undefined : product.stock}
                  value={quantity}
                  onChange={(event) => {
                    const nextValue = Math.max(0, Math.floor(Number(event.target.value)));
                    updateQuantity(product.id, allowOverstock ? nextValue : Math.min(nextValue, product.stock));
                  }}
                  className="w-20 text-center"
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(product.id, quantity + 1)}
                  disabled={disabled || !canIncrease}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay productos que coincidan con el filtro.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {selected.length} producto(s) añadidos
        </span>
        <span className="font-semibold text-foreground">{totalAmount.toFixed(2)}€</span>
      </div>
    </div>
  );
};

export default ProductSelector;
