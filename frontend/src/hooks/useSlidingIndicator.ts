import * as React from 'react';

export type SlidingIndicatorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: string;
};

type UseSlidingIndicatorOptions = {
  activeKey?: unknown;
  activeSelector: string;
};

const sameRect = (
  current: SlidingIndicatorRect | null,
  next: SlidingIndicatorRect,
) => Boolean(
  current &&
  current.x === next.x &&
  current.y === next.y &&
  current.width === next.width &&
  current.height === next.height &&
  current.borderRadius === next.borderRadius,
);

export const useSlidingIndicator = <T extends HTMLElement>({
  activeKey,
  activeSelector,
}: UseSlidingIndicatorOptions) => {
  const containerRef = React.useRef<T | null>(null);
  const [indicator, setIndicator] = React.useState<SlidingIndicatorRect | null>(null);

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    const activeElement = container?.querySelector<HTMLElement>(activeSelector);
    if (!activeElement) {
      setIndicator(null);
      return;
    }

    const nextIndicator: SlidingIndicatorRect = {
      x: activeElement.offsetLeft,
      y: activeElement.offsetTop,
      width: activeElement.offsetWidth,
      height: activeElement.offsetHeight,
      borderRadius: window.getComputedStyle(activeElement).borderRadius,
    };
    setIndicator((current) => sameRect(current, nextIndicator) ? current : nextIndicator);
  }, [activeSelector]);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    updateIndicator();

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(updateIndicator);
    mutationObserver?.observe(container, {
      attributes: true,
      attributeFilter: ['data-state', 'data-sliding-active'],
      childList: true,
      characterData: true,
      subtree: true,
    });

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateIndicator);
      return () => {
        mutationObserver?.disconnect();
        window.removeEventListener('resize', updateIndicator);
      };
    }

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(container);
    container.querySelectorAll<HTMLElement>(activeSelector).forEach((element) => {
      resizeObserver.observe(element);
    });

    return () => {
      mutationObserver?.disconnect();
      resizeObserver.disconnect();
    };
  }, [activeKey, activeSelector, updateIndicator]);

  return { containerRef, indicator };
};
