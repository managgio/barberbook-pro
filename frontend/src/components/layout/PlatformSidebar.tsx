import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Building2, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import managgioLogo from '@/assets/img/managgio/logo.png';

const navItems = [
  { href: '/platform', label: 'Resumen', icon: LayoutDashboard },
  { href: '/platform/brands', label: 'Clientes', icon: Building2 },
];

interface PlatformSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const PlatformSidebar: React.FC<PlatformSidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/platform') return location.pathname === '/platform';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-border flex flex-col z-40 w-64 transition-all duration-300',
        collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 md:w-64'
      )}
    >
      <div className={cn('border-b border-sidebar-border relative', collapsed ? 'p-4' : 'p-5')}>
        <Link to="/platform" className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shadow-sm">
            <img src={managgioLogo} alt="Managgio logo" className="w-8 h-8 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-lg font-semibold text-sidebar-foreground">Managgio</div>
              <div className="text-xs text-muted-foreground">Platform Admin</div>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'hidden md:inline-flex transition-all duration-300',
            collapsed ? 'absolute top-4 -right-5' : 'absolute top-5 -right-4 bg-background shadow-lg border rounded-full'
          )}
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </Button>
      </div>

      <nav className={cn('flex-1 p-4 space-y-1', collapsed && 'px-2')}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              isActive(item.href)
                ? 'bg-sidebar-accent text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              collapsed && 'justify-center'
            )}
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className={cn('flex items-center gap-3 mb-3', collapsed && 'justify-center')}>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <div className={cn('flex gap-2', collapsed && 'flex-col')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              navigate('/auth');
            }}
            className={cn(collapsed && 'px-0 justify-center')}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-1">Salir</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default PlatformSidebar;
