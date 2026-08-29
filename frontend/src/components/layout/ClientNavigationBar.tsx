import React from 'react';
import { Link } from 'react-router-dom';

import { SlidingSelectionIndicator } from '@/components/ui/sliding-indicator';
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator';
import { cn } from '@/lib/utils';
import type { ClientNavItem } from './clientNavItems';

type ClientNavigationBarProps = {
  items: ClientNavItem[];
  pathname: string;
  translate: (key: string) => string;
};

const isItemActive = (pathname: string, item: ClientNavItem) => (
  item.exact ? pathname === item.href : pathname.startsWith(item.href)
);

const ClientNavigationBar: React.FC<ClientNavigationBarProps> = ({
  items,
  pathname,
  translate,
}) => {
  const { containerRef, indicator } = useSlidingIndicator<HTMLDivElement>({
    activeKey: `${pathname}:${items.map((item) => item.href).join(',')}`,
    activeSelector: '[data-client-nav-item][data-sliding-active="true"]',
  });

  return (
    <nav
      aria-label={translate('clientNav.ariaLabel')}
      className="sticky top-16 z-30 border-b border-border bg-card/50 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4">
        <div
          ref={containerRef}
          className="scrollbar-none relative isolate flex items-center gap-1.5 overflow-x-auto py-2 sm:gap-2 sm:py-3"
        >
          <SlidingSelectionIndicator
            indicator={indicator}
            testId="client-nav-sliding-indicator"
            className="bg-primary shadow-sm"
          />
          {items.map((item, index) => {
            const active = isItemActive(pathname, item);
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? 'page' : undefined}
                data-client-nav-item
                data-nav-index={index}
                data-sliding-active={active ? 'true' : 'false'}
                className={cn(
                  'relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-transparent px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-200 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
                  active
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {translate(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default ClientNavigationBar;
