import { reportWebVital } from '@/data/api/observability';

type VitalName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";
type VitalRating = "good" | "needs-improvement" | "poor";

type VitalMetric = {
  name: VitalName;
  value: number;
  rating: VitalRating;
  path: string;
  timestamp: number;
};

const thresholds: Record<VitalName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

const isSupported = () =>
  typeof window !== "undefined" &&
  "performance" in window &&
  "PerformanceObserver" in window;

const getRating = (name: VitalName, value: number): VitalRating => {
  const [good, poor] = thresholds[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
};

const dispatchMetric = (metric: VitalMetric) => {
  window.dispatchEvent(new CustomEvent("web-vital", { detail: metric }));
  reportWebVital(metric);
  if (import.meta.env.DEV) {
    // Keep visibility in local runs without adding remote telemetry dependencies.
    console.info("[WebVitals]", metric);
  }
};

const report = (name: VitalName, value: number) => {
  dispatchMetric({
    name,
    value,
    rating: getRating(name, value),
    path: window.location.pathname,
    timestamp: Date.now(),
  });
};

export const startWebVitalsTracking = () => {
  if (!isSupported()) return;

  let hasReportedLcp = false;
  let hasReportedCls = false;
  let hasReportedInp = false;
  let clsValue = 0;
  let inpValue = 0;

  const reportOnPageHide = () => {
    if (!hasReportedCls) {
      hasReportedCls = true;
      report("CLS", clsValue);
    }
    if (!hasReportedInp && inpValue > 0) {
      hasReportedInp = true;
      report("INP", inpValue);
    }
  };

  try {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigationEntry) {
      report("TTFB", navigationEntry.responseStart);
    }

    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntriesByName("first-contentful-paint")) {
        report("FCP", entry.startTime);
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });

    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (!lastEntry || hasReportedLcp) return;
      report("LCP", lastEntry.startTime);
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as Array<LayoutShift>) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });

    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as Array<PerformanceEventTiming>) {
        if (entry.duration > inpValue) {
          inpValue = entry.duration;
        }
      }
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (!hasReportedLcp) {
        hasReportedLcp = true;
      }
      reportOnPageHide();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, { once: true });
    window.addEventListener("pagehide", reportOnPageHide, { once: true });
  } catch {
    // Web Vitals support varies by browser; fail silently.
  }
};
