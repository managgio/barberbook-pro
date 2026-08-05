import type {
  PlatformObservabilityApiSummary,
  PlatformObservabilityWebVitalsSummary,
  PlatformCriticalTraceSummary,
} from '@/data/types';
import { formatCriticalTraceBreadcrumbs } from '@/lib/criticalTracePresentation';

type ReportInput = {
  windowLabel: string;
  webVitals: PlatformObservabilityWebVitalsSummary;
  api: PlatformObservabilityApiSummary;
  tenants?: Array<{ brandId: string; brandName: string; subdomain: string }>;
  criticalTraces?: PlatformCriticalTraceSummary;
};

const formatDate = (value: string | number) =>
  new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));

const formatVital = (name: string, value: number) =>
  name === 'CLS' ? value.toFixed(3) : `${value.toFixed(0)} ms`;

const healthForVital = (poor: number, needsImprovement: number) =>
  poor > 0 ? 'CRÍTICO' : needsImprovement > 0 ? 'VIGILAR' : 'OK';

const healthForApi = (errorRate: number, p95: number, has5xx: boolean) => {
  if (has5xx || errorRate >= 5 || p95 >= 2_000) return 'CRÍTICO';
  if (errorRate >= 1 || p95 >= 1_000) return 'VIGILAR';
  return 'OK';
};

export const generatePlatformObservabilityPdf = async ({ windowLabel, webVitals, api, tenants = [], criticalTraces }: ReportInput) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const brandToClient = new Map<string, string>();
  tenants.forEach((tenant) => brandToClient.set(tenant.brandId, `${tenant.brandName} (${tenant.subdomain})`));
  api.topRoutes.forEach((row) => {
    if (row.subdomain && !brandToClient.has(row.brandId)) brandToClient.set(row.brandId, row.subdomain);
  });

  const title = (text: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(24, 43, 77);
    doc.text(text, margin, y);
  };

  doc.setFillColor(17, 35, 67);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MANAGGIO · INFORME DE OBSERVABILIDAD', margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Ventana: ${windowLabel} · Entorno: ${webVitals.environment.toUpperCase()} · Generado: ${formatDate(webVitals.generatedAt)}`, margin, 21);
  doc.text(`Periodo analizado: ${formatDate(webVitals.range.start)} — ${formatDate(webVitals.range.end)}`, margin, 26);

  title('Resumen ejecutivo', 40);
  autoTable(doc, {
    startY: 44,
    theme: 'grid',
    head: [['Área', 'Eventos', 'Elementos analizados', 'Críticos', 'Vigilar', 'OK']],
    body: [
      [
        'Web Vitals',
        webVitals.totalEvents,
        webVitals.byMetric.length,
        webVitals.byMetric.filter((row) => row.ratings.poor > 0).length,
        webVitals.byMetric.filter((row) => row.ratings.poor === 0 && row.ratings.needsImprovement > 0).length,
        webVitals.byMetric.filter((row) => row.ratings.poor === 0 && row.ratings.needsImprovement === 0).length,
      ],
      [
        'API',
        api.totalEvents,
        api.topRoutes.length,
        api.topRoutes.filter((row) => healthForApi(row.errorRate, row.p95DurationMs, row.statuses.some((item) => item.status >= 500)) === 'CRÍTICO').length,
        api.topRoutes.filter((row) => healthForApi(row.errorRate, row.p95DurationMs, row.statuses.some((item) => item.status >= 500)) === 'VIGILAR').length,
        api.topRoutes.filter((row) => healthForApi(row.errorRate, row.p95DurationMs, row.statuses.some((item) => item.status >= 500)) === 'OK').length,
      ],
      ...(criticalTraces?.includeInPdf ? [[
        'Trazas críticas',
        criticalTraces.totalEvents,
        new Set(criticalTraces.traces.map((trace) => trace.traceId)).size,
        criticalTraces.failedEvents,
        0,
        criticalTraces.traces.filter((trace) => trace.outcome === 'succeeded').length,
      ]] : []),
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [35, 70, 120] },
  });

  title('Web Vitals · resumen global', 78);
  autoTable(doc, {
    startY: 82,
    theme: 'striped',
    head: [['Estado', 'Métrica', 'Promedio', 'P75', 'P95', 'Muestras', 'Good', 'Needs improvement', 'Poor']],
    body: webVitals.byMetric.map((row) => [
      healthForVital(row.ratings.poor, row.ratings.needsImprovement), row.name,
      formatVital(row.name, row.avg), formatVital(row.name, row.p75), formatVital(row.name, row.p95),
      row.count, row.ratings.good, row.ratings.needsImprovement, row.ratings.poor,
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [35, 70, 120] },
  });

  doc.addPage();
  title('Web Vitals · detalle por cliente, local y ruta', 14);
  autoTable(doc, {
    startY: 18,
    theme: 'grid',
    head: [['Estado', 'Cliente', 'Local', 'Métrica', 'Ruta', 'Media', 'P95', 'Muestras', 'Good / NI / Poor', 'Primera muestra', 'Última muestra']],
    body: webVitals.tenantBreakdown.map((row) => [
      healthForVital(row.ratings.poor, row.ratings.needsImprovement),
      brandToClient.get(row.brandId) || row.brandId,
      row.localId,
      row.name,
      row.path,
      formatVital(row.name, row.avg),
      formatVital(row.name, row.p95),
      row.count,
      `${row.ratings.good} / ${row.ratings.needsImprovement} / ${row.ratings.poor}`,
      formatDate(row.firstSeenAt),
      formatDate(row.lastSeenAt),
    ]),
    styles: { fontSize: 6.2, cellPadding: 1.4, overflow: 'linebreak' },
    headStyles: { fillColor: [35, 70, 120] },
    columnStyles: { 4: { cellWidth: 46 }, 9: { cellWidth: 27 }, 10: { cellWidth: 27 } },
    didDrawPage: () => title('Web Vitals · detalle por cliente, local y ruta', 14),
  });

  doc.addPage();
  title('API · Top endpoints por cliente', 14);
  autoTable(doc, {
    startY: 18,
    theme: 'grid',
    head: [['Estado', 'Cliente', 'Local', 'Método', 'Endpoint', 'Media', 'P95', 'Error 5xx', 'Hits', 'Distribución HTTP']],
    body: api.topRoutes.map((row) => [
      healthForApi(row.errorRate, row.p95DurationMs, row.statuses.some((item) => item.status >= 500)),
      brandToClient.get(row.brandId) || row.subdomain || row.brandId,
      row.localId,
      row.method,
      row.route,
      `${row.avgDurationMs.toFixed(0)} ms`,
      `${row.p95DurationMs.toFixed(0)} ms`,
      `${row.errorRate.toFixed(2)}%`,
      row.count,
      row.statuses.map((item) => `${item.status}: ${item.count}`).join(' · '),
    ]),
    styles: { fontSize: 6.8, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [35, 70, 120] },
    columnStyles: { 4: { cellWidth: 58 }, 9: { cellWidth: 42 } },
    didDrawPage: () => title('API · Top endpoints por cliente', 14),
  });

  doc.addPage();
  title('API · muestras más lentas', 14);
  autoTable(doc, {
    startY: 18,
    theme: 'striped',
    head: [['Fecha', 'Cliente', 'Local', 'Método', 'Endpoint', 'HTTP', 'Duración']],
    body: api.slowestSamples.map((row) => [
      formatDate(row.timestamp), brandToClient.get(row.brandId) || row.subdomain || row.brandId, row.localId, row.method, row.route,
      row.statusCode, `${row.durationMs.toFixed(0)} ms`,
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [35, 70, 120] },
    columnStyles: { 4: { cellWidth: 90 } },
  });

  if (criticalTraces?.includeInPdf) {
    doc.addPage();
    title('Trazas críticas', 14);
    autoTable(doc, {
      startY: 18,
      theme: 'grid',
      head: [['Fecha', 'Resultado', 'Área', 'Tenant / local', 'Usuario', 'Etapa', 'Contexto funcional', 'Fecha objetivo', 'Error / detalle', 'Trace ID']],
      body: criticalTraces.traces.map((trace) => [
        formatDate(trace.occurredAt),
        trace.outcome === 'failed' ? 'ERROR' : trace.outcome === 'started' ? 'INICIADO' : 'CORRECTO',
        trace.category,
        `${trace.brandName || trace.subdomain || trace.brandId}\n${trace.localName || trace.localId}`,
        `${trace.userName || 'Invitado/no identificado'}\n${trace.userEmail || trace.userId || ''}`,
        trace.stage,
        `${trace.serviceName || trace.serviceId || '-'}\n${trace.barberName || trace.barberId || '-'}`,
        trace.selectedDateTime ? formatDate(trace.selectedDateTime) : '-',
        [
          trace.message,
          trace.errorName,
          trace.errorCode,
          formatCriticalTraceBreadcrumbs(trace.metadata)
            ? `Recorrido: ${formatCriticalTraceBreadcrumbs(trace.metadata)}`
            : null,
        ].filter(Boolean).join(' · ') || 'Sin error',
        trace.traceId,
      ]),
      styles: { fontSize: 5.7, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [35, 70, 120] },
      columnStyles: { 0: { cellWidth: 23 }, 4: { cellWidth: 34 }, 8: { cellWidth: 45 }, 9: { cellWidth: 32 } },
      didDrawPage: () => title('Trazas críticas', 14),
    });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(`Managgio · Observabilidad · ${webVitals.environment} · Página ${page}/${pages}`, pageWidth - margin, 202, { align: 'right' });
  }

  const date = webVitals.generatedAt.slice(0, 10);
  doc.save(`managgio-observabilidad-${date}-${webVitals.windowMinutes}min.pdf`);
};
