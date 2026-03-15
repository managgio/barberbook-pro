import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, History, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LocalizedEntitySummary, LocalizedSummaryStatus } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';

type LocalizationStatusBadgeProps = {
  summary?: LocalizedEntitySummary | null;
};

const ICON_BY_STATUS: Record<LocalizedSummaryStatus, React.ComponentType<{ className?: string }>> = {
  ready: CheckCircle2,
  pending: Clock3,
  failed: AlertTriangle,
  stale: History,
  missing: Sparkles,
};

const STYLE_BY_STATUS: Record<LocalizedSummaryStatus, string> = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  stale: 'border-orange-500/30 bg-orange-500/10 text-orange-600',
  missing: 'border-border bg-muted/40 text-muted-foreground',
};

const LocalizationStatusBadge: React.FC<LocalizationStatusBadgeProps> = ({ summary }) => {
  const { t } = useI18n();
  const status: LocalizedSummaryStatus = summary?.status || 'missing';
  const Icon = ICON_BY_STATUS[status];

  const issueCount =
    (summary?.pendingCount || 0) +
    (summary?.failedCount || 0) +
    (summary?.staleCount || 0) +
    (summary?.missingCount || 0);

  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1.5 ${STYLE_BY_STATUS[status]}`}>
      <Icon className="h-3 w-3" />
      <span>{t(`admin.localization.status.${status}`)}</span>
      {issueCount > 0 ? <span className="font-semibold">({issueCount})</span> : null}
    </Badge>
  );
};

export default LocalizationStatusBadge;
