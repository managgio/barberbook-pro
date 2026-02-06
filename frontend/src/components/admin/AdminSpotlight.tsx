import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import {
  ADMIN_NAV_DEFAULT_ORDER,
  adminNavItems,
  resolveAdminNavOrder,
  resolveAdminNavItemLabel,
  sortAdminNavItems,
} from '@/components/layout/adminNavItems';
import { useAdminSpotlight } from '@/components/admin/AdminSpotlightContext';
import { updateSiteSettings } from '@/data/api';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useToast } from '@/hooks/use-toast';
import { AdminSectionKey } from '@/data/types';
import { GripVertical, Loader2, RotateCcw } from 'lucide-react';
import { useBusinessCopy } from '@/lib/businessCopy';
import { dispatchSiteSettingsUpdated } from '@/lib/adminEvents';

const isHotkey = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  return key === 'b' && (event.metaKey || event.ctrlKey) && !event.shiftKey;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

const toOrderKey = (order: AdminSectionKey[]) => order.join('|');

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

const AdminSpotlight: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const { settings } = useSiteSettings();
  const { canAccessSection, isLoading } = useAdminPermissions();
  const { open, setOpen } = useAdminSpotlight();
  const [query, setQuery] = useState('');
  const [suppressDefaultSelection, setSuppressDefaultSelection] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState<AdminSectionKey[]>(() => resolveAdminNavOrder(undefined));
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [draggingSection, setDraggingSection] = useState<AdminSectionKey | null>(null);
  const [dragOverSection, setDragOverSection] = useState<AdminSectionKey | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after'>('before');
  const canManageSidebarOrder = canAccessSection('settings');

  const resolvedStoredOrder = useMemo(
    () => resolveAdminNavOrder(settings.adminSidebar?.order),
    [settings.adminSidebar?.order],
  );
  const resolvedStoredOrderKey = useMemo(() => toOrderKey(resolvedStoredOrder), [resolvedStoredOrder]);

  useEffect(() => {
    if (!isSavingOrder) {
      setSidebarOrder(resolvedStoredOrder);
    }
  }, [isSavingOrder, resolvedStoredOrder, resolvedStoredOrderKey]);

  const items = useMemo(() => {
    const visibleItems = adminNavItems.filter((item) => canAccessSection(item.section));
    return sortAdminNavItems(visibleItems, sidebarOrder).map((item) => ({
      ...item,
      label: resolveAdminNavItemLabel(item, copy),
    }));
  }, [canAccessSection, sidebarOrder, copy]);

  const isDefaultSidebarOrder = useMemo(
    () => toOrderKey(resolveAdminNavOrder(sidebarOrder)) === toOrderKey(ADMIN_NAV_DEFAULT_ORDER),
    [sidebarOrder],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isHotkey(event)) return;
      if (isEditableTarget(event.target) && !open) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDraggingSection(null);
      setDragOverSection(null);
      setDragOverPosition('before');
      setSuppressDefaultSelection(false);
      return;
    }
    setSuppressDefaultSelection(true);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setQuery('');
  }, [location.pathname, open]);

  useEffect(() => {
    if (!open || !suppressDefaultSelection) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab') {
        setSuppressDefaultSelection(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, suppressDefaultSelection]);

  const emptyLabel = isLoading ? 'Cargando accesos...' : 'No hay coincidencias.';

  const persistSidebarOrder = useCallback(
    async (nextOrder: AdminSectionKey[]) => {
      if (!canManageSidebarOrder) return;
      setSidebarOrder(nextOrder);
      setIsSavingOrder(true);
      try {
        const updated = await updateSiteSettings({
          ...settings,
          adminSidebar: {
            ...(settings.adminSidebar ?? {}),
            order: nextOrder,
          },
        });
        dispatchSiteSettingsUpdated(updated);
      } catch (error) {
        setSidebarOrder(resolvedStoredOrder);
        toast({
          title: 'No se pudo guardar el orden',
          description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
          variant: 'destructive',
        });
      } finally {
        setIsSavingOrder(false);
      }
    },
    [canManageSidebarOrder, resolvedStoredOrder, settings, toast],
  );

  const handleSidebarDragStart = (event: React.DragEvent<HTMLElement>, index: number, section: AdminSectionKey) => {
    if (isSavingOrder) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDraggingSection(section);
    setDragOverSection(null);
  };

  const handleSidebarDragOver = (event: React.DragEvent<HTMLDivElement>, section: AdminSectionKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const middleY = bounds.top + bounds.height / 2;
    setDragOverPosition(event.clientY <= middleY ? 'before' : 'after');
    setDragOverSection(section);
  };

  const handleSidebarDrop = (event: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isNaN(fromIndex) || fromIndex === dropIndex) {
      setDraggingSection(null);
      setDragOverSection(null);
      setDragOverPosition('before');
      return;
    }

    const visibleSections = items.map((item) => item.section);
    const insertIndex = dropIndex + (dragOverPosition === 'after' ? 1 : 0);
    const reorderedVisible = reorderByInsertIndex(visibleSections, fromIndex, insertIndex);
    const visibleSet = new Set(visibleSections);
    let cursor = 0;
    const nextOrder = resolveAdminNavOrder(sidebarOrder).map((section) =>
      visibleSet.has(section) ? reorderedVisible[cursor++] : section,
    );
    void persistSidebarOrder(nextOrder);
    setDraggingSection(null);
    setDragOverSection(null);
    setDragOverPosition('before');
  };

  const handleResetSidebarOrder = () => {
    if (isSavingOrder || isDefaultSidebarOrder) return;
    void persistSidebarOrder([...ADMIN_NAV_DEFAULT_ORDER]);
  };

  const canDragSidebar = canManageSidebarOrder && query.trim().length === 0 && !isSavingOrder;

  useEffect(() => {
    if (query.trim().length === 0) return;
    setDraggingSection(null);
    setDragOverSection(null);
    setDragOverPosition('before');
    setSuppressDefaultSelection(false);
  }, [query]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Spotlight"
      contentClassName="lg:max-w-2xl xl:max-w-3xl lg:h-[68vh] lg:max-h-[68vh]"
    >
      <div className="border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-medium text-foreground">Spotlight</div>
            {canManageSidebarOrder && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleResetSidebarOrder}
                disabled={isSavingOrder || isDefaultSidebarOrder}
                title="Restablecer orden por defecto"
                aria-label="Restablecer orden por defecto del sidebar"
              >
                {isSavingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Busca, navega y reordena desde el asa lateral.</div>
        </div>
      </div>
      <CommandInput
        placeholder="Escribe una seccion..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList
        className="max-h-[340px] lg:max-h-[48vh]"
        onMouseMove={() => {
          if (suppressDefaultSelection) setSuppressDefaultSelection(false);
        }}
      >
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup heading="Secciones">
          {items.map((item, index) => {
            const isDragging = draggingSection === item.section;
            const isDragOver = dragOverSection === item.section && draggingSection !== item.section;
            return (
              <CommandItem
                key={item.href}
                value={[item.label, ...(item.keywords || [])].join(' ')}
                onSelect={() => {
                  setOpen(false);
                  navigate(item.href);
                }}
                onDragOver={(event) => {
                  if (!canDragSidebar) return;
                  handleSidebarDragOver(event, item.section);
                }}
                onDrop={(event) => {
                  if (!canDragSidebar) return;
                  handleSidebarDrop(event, index);
                }}
                onDragEnd={() => {
                  setDraggingSection(null);
                  setDragOverSection(null);
                  setDragOverPosition('before');
                }}
                className={cn(
                  'relative',
                  location.pathname.startsWith(item.href) && item.href !== '/admin' && 'bg-accent/60',
                  location.pathname === '/admin' && item.href === '/admin' && 'bg-accent/60',
                  isDragging && 'border border-primary/40 bg-primary/10',
                  isDragOver && 'border border-primary/40 bg-primary/5',
                  suppressDefaultSelection && 'data-[selected=true]:bg-transparent data-[selected=true]:text-foreground',
                )}
              >
                {isDragOver && dragOverPosition === 'before' && (
                  <span className="pointer-events-none absolute -top-[1px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                )}
                {isDragOver && dragOverPosition === 'after' && (
                  <span className="pointer-events-none absolute -bottom-[1px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                )}
                {canManageSidebarOrder && (
                  <button
                    type="button"
                    draggable={canDragSidebar}
                    onDragStart={(event) => handleSidebarDragStart(event, index, item.section)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    className={cn(
                      'mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/80',
                      canDragSidebar ? 'cursor-grab active:cursor-grabbing hover:bg-accent/70 hover:text-foreground' : 'cursor-not-allowed opacity-40',
                    )}
                    aria-label={`Reordenar ${item.label}`}
                    title={canDragSidebar ? 'Arrastra para reordenar' : 'Limpia la búsqueda para reordenar'}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                )}
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">Enter</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <CommandSeparator />
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <span>Ctrl/Cmd + B</span>
        <span>Esc para cerrar</span>
      </div>
    </CommandDialog>
  );
};

export default AdminSpotlight;
