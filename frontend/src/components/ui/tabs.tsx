import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { SlidingSelectionIndicator } from "@/components/ui/sliding-indicator";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";

const Tabs = TabsPrimitive.Root;

const assignRef = <T,>(ref: React.ForwardedRef<T>, value: T | null) => {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
};

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  indicatorClassName?: string;
  indicatorKey?: unknown;
  indicatorTestId?: string;
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ children, className, indicatorClassName, indicatorKey, indicatorTestId, ...props }, forwardedRef) => {
  const { containerRef, indicator } = useSlidingIndicator<HTMLDivElement>({
    activeKey: indicatorKey,
    activeSelector: '[role="tab"][data-state="active"]',
  });

  return (
    <TabsPrimitive.List
      ref={(node) => {
        containerRef.current = node;
        assignRef(forwardedRef, node);
      }}
      className={cn(
        "relative isolate inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    >
      <SlidingSelectionIndicator
        indicator={indicator}
        testId={indicatorTestId || "tabs-sliding-indicator"}
        className={cn("bg-background shadow-sm", indicatorClassName)}
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-sm bg-transparent px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
