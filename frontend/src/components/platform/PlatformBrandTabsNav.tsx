import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PLATFORM_BRAND_TABS,
  PLATFORM_BRAND_TAB_LABELS,
  type PlatformBrandTab,
} from './platformBrandTabs';

interface PlatformBrandTabsNavProps {
  activeTab: PlatformBrandTab;
}

const PlatformBrandTabsNav: React.FC<PlatformBrandTabsNavProps> = ({ activeTab }) => {
  return (
    <TabsList
      className="scrollbar-none relative isolate flex w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto sm:grid sm:grid-cols-8 sm:justify-center sm:overflow-visible"
      indicatorKey={activeTab}
      indicatorTestId="platform-brand-tab-indicator"
    >
      {PLATFORM_BRAND_TABS.map((tab, index) => (
        <TabsTrigger
          key={tab}
          value={tab}
          data-tab-index={index}
          className="shrink-0"
        >
          {PLATFORM_BRAND_TAB_LABELS[tab]}
        </TabsTrigger>
      ))}
    </TabsList>
  );
};

export default PlatformBrandTabsNav;
