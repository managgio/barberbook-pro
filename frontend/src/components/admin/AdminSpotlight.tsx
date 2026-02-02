import React, { useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import { adminNavItems } from '@/components/layout/adminNavItems';
import { useAdminSpotlight } from '@/components/admin/AdminSpotlightContext';

const isHotkey = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  return key === 'b' && (event.metaKey || event.ctrlKey) && !event.shiftKey;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

const AdminSpotlight: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessSection, isLoading } = useAdminPermissions();
  const { open, setOpen } = useAdminSpotlight();
  const [query, setQuery] = useState('');

  const items = useMemo(
    () => adminNavItems.filter((item) => canAccessSection(item.section)),
    [canAccessSection],
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
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    setQuery('');
  }, [location.pathname, open]);

  const emptyLabel = isLoading ? 'Cargando accesos...' : 'No hay coincidencias.';

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-medium text-foreground">Spotlight</div>
        <div className="text-xs text-muted-foreground">Busca y navega rapido por el panel admin.</div>
      </div>
      <CommandInput
        placeholder="Escribe una seccion..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[340px]">
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup heading="Secciones">
          {items.map((item) => (
            <CommandItem
              key={item.href}
              value={[item.label, ...(item.keywords || [])].join(' ')}
              onSelect={() => {
                setOpen(false);
                navigate(item.href);
              }}
              className={cn(
                location.pathname.startsWith(item.href) && item.href !== '/admin' && 'bg-accent/60',
                location.pathname === '/admin' && item.href === '/admin' && 'bg-accent/60',
              )}
            >
              <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">Enter</span>
            </CommandItem>
          ))}
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
