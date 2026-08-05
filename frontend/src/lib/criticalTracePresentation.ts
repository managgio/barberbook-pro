type BreadcrumbRecord = {
  stage?: unknown;
  elapsedMs?: unknown;
};

export const formatCriticalTraceBreadcrumbs = (metadata: Record<string, unknown> | null) => {
  const serialized = metadata?.breadcrumbs;
  if (typeof serialized !== 'string' || serialized.length === 0) return null;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) return null;
    const labels = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const breadcrumb = item as BreadcrumbRecord;
        if (typeof breadcrumb.stage !== 'string') return null;
        const elapsed = typeof breadcrumb.elapsedMs === 'number'
          ? ` (+${breadcrumb.elapsedMs < 1_000 ? `${breadcrumb.elapsedMs} ms` : `${(breadcrumb.elapsedMs / 1_000).toFixed(1)} s`})`
          : '';
        return `${breadcrumb.stage}${elapsed}`;
      })
      .filter((label): label is string => Boolean(label));
    return labels.length > 0 ? labels.join(' → ') : null;
  } catch {
    return null;
  }
};
