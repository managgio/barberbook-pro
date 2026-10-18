import { Building2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformMessagingTenantUsage } from '@/data/types';
import { useI18n } from '@/hooks/useI18n';
import { buildSmsTenantSpendRows } from './smsTenantSpendModel';

type PlatformSmsTenantSpendProps = {
  items: PlatformMessagingTenantUsage[];
  isLoading: boolean;
  windowDays: number;
  displayCurrencyCode: string;
  usdDisplayRate?: number | null;
};

export function PlatformSmsTenantSpend({
  items,
  isLoading,
  windowDays,
  displayCurrencyCode,
  usdDisplayRate,
}: PlatformSmsTenantSpendProps) {
  const { t, language } = useI18n();
  const { rows, totalCostUsd, totalMessages } = buildSmsTenantSpendRows(items);
  const locale = language === 'en' ? 'en-US' : 'es-ES';
  const displayRate = usdDisplayRate && usdDisplayRate > 0 ? usdDisplayRate : 1;
  const formatMoney = (valueUsd: number) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: displayCurrencyCode,
    maximumFractionDigits: 2,
  }).format(valueUsd * displayRate);
  const formatNumber = (value: number) => new Intl.NumberFormat(locale).format(value);
  const formatPercentage = (value: number) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

  return (
    <Card className="border border-border/60 bg-card/70 lg:col-span-2">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{t('platform.smsTenantSpend.title')}</CardTitle>
          </div>
          <Badge variant="secondary">
            {t('platform.smsTenantSpend.activeTenants', { count: rows.length })}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('platform.smsTenantSpend.description', { days: windowDays })}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('platform.smsTenantSpend.loading')}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{t('platform.smsTenantSpend.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('platform.smsTenantSpend.emptyDescription')}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('platform.smsTenantSpend.totalCost')}</p>
                <p className="text-lg font-semibold text-foreground">{formatMoney(totalCostUsd)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('platform.smsTenantSpend.totalMessages')}</p>
                <p className="text-lg font-semibold text-foreground">{formatNumber(totalMessages)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('platform.smsTenantSpend.topTenant')}</p>
                <p className="truncate text-sm font-semibold text-foreground">{rows[0]?.brandName}</p>
              </div>
            </div>

            {totalCostUsd > 0 ? (
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={t('platform.smsTenantSpend.chartLabel')}
              >
                {rows.map((row) => (
                  <div
                    key={row.brandId}
                    className="h-full min-w-[2px] transition-[width] duration-300"
                    style={{ width: `${row.sharePercentage}%`, backgroundColor: row.color }}
                    title={`${row.brandName}: ${formatPercentage(row.sharePercentage)}%`}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {t('platform.smsTenantSpend.costPending')}
              </div>
            )}

            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {rows.map((row, index) => (
                <div key={row.brandId} className="rounded-xl border border-border/60 bg-background/45 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: row.color }}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{row.brandName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.subdomain ? `${row.subdomain}.managgio.com` : row.brandId}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{formatMoney(row.costUsd)}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalCostUsd > 0
                          ? `${formatPercentage(row.sharePercentage)}%`
                          : t('platform.smsTenantSpend.percentagePending')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={t('platform.smsTenantSpend.tenantShareLabel', { tenant: row.brandName })}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Number(row.sharePercentage.toFixed(1))}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${row.sharePercentage}%`, backgroundColor: row.color }}
                      />
                    </div>
                    <span className="min-w-[5.5rem] text-right text-xs text-muted-foreground">
                      {t('platform.smsTenantSpend.smsCount', { count: formatNumber(row.messagesCount) })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
