import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Keyboard,
  LayoutTemplate,
  MessageSquareText,
  Mic,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPlatformAiConversation, getPlatformAiConversations } from '@/data/api/platform';
import {
  PlatformAiConversationListResponse,
  PlatformAiConversationSource,
} from '@/data/types';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

const sourceMeta: Record<PlatformAiConversationSource, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}> = {
  typed: { label: 'Escrito', icon: Keyboard, className: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  voice: { label: 'Voz', icon: Mic, className: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
  template: { label: 'Plantilla', icon: LayoutTemplate, className: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin actividad';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const SourceBadge: React.FC<{
  source?: PlatformAiConversationSource | null;
  templateKey?: string | null;
}> = ({ source, templateKey }) => {
  if (!source) return null;
  const meta = sourceMeta[source];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px] font-medium', meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}{templateKey ? ` · ${templateKey}` : ''}
    </Badge>
  );
};

const PlatformAiConversations: React.FC = () => {
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<PlatformAiConversationSource | undefined>();
  const [brandId, setBrandId] = useState<string | undefined>();
  const [localId, setLocalId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const filters = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    days,
    brandId,
    localId,
    source,
    search: debouncedSearch || undefined,
  }), [brandId, days, debouncedSearch, localId, page, source]);

  const listQuery = useQuery<PlatformAiConversationListResponse>({
    queryKey: queryKeys.platformAiConversations(filters),
    queryFn: () => getPlatformAiConversations(filters),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const items = listQuery.data?.items || [];
    if (items.length === 0) {
      setSelectedSessionId(null);
      return;
    }
    if (!selectedSessionId || !items.some((item) => item.id === selectedSessionId)) {
      setSelectedSessionId(items[0].id);
    }
  }, [listQuery.data?.items, selectedSessionId]);

  const detailQuery = useQuery({
    queryKey: queryKeys.platformAiConversation(selectedSessionId),
    enabled: Boolean(selectedSessionId),
    queryFn: () => getPlatformAiConversation(selectedSessionId as string),
  });

  const summary = listQuery.data?.summary;
  const sourceTotal = Object.values(summary?.sources || {}).reduce((total, value) => total + value, 0);
  const selectedTenant = listQuery.data?.tenantActivity.find((tenant) => tenant.localId === localId);

  const resetScope = () => {
    setBrandId(undefined);
    setLocalId(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-4 w-4" />
            Calidad conversacional
          </div>
          <h1 className="text-3xl font-bold text-foreground">Asistente IA</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Revisa cómo usan el asistente los tenants, detecta patrones y compara mensajes escritos, voz y plantillas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 7, 30, 90].map((option) => (
            <Button
              key={option}
              type="button"
              variant={days === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setDays(option); setPage(1); }}
            >
              {option === 1 ? 'Hoy' : `${option} días`}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void listQuery.refetch()}
            aria-label="Actualizar conversaciones"
          >
            <RefreshCw className={cn('h-4 w-4', listQuery.isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Conversaciones', value: summary?.sessions || 0, icon: Bot, tone: 'text-primary bg-primary/10' },
          { label: 'Mensajes', value: summary?.messages || 0, icon: MessageSquareText, tone: 'text-sky-500 bg-sky-500/10' },
          { label: 'Tenants activos', value: summary?.activeTenants || 0, icon: Building2, tone: 'text-violet-500 bg-violet-500/10' },
          { label: 'Retención', value: `${listQuery.data?.retentionDays || 90} días`, icon: ShieldCheck, tone: 'text-emerald-500 bg-emerald-500/10' },
        ].map((metric) => (
          <Card key={metric.label} variant="elevated">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{metric.value}</p>
              </div>
              <div className={cn('rounded-2xl p-3', metric.tone)}>
                <metric.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-base">Origen de los mensajes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(sourceMeta) as PlatformAiConversationSource[]).map((key) => {
              const meta = sourceMeta[key];
              const Icon = meta.icon;
              const count = summary?.sources[key] || 0;
              const percentage = sourceTotal > 0 ? Math.round((count / sourceTotal) * 100) : 0;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => { setSource((current) => current === key ? undefined : key); setPage(1); }}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition-colors',
                    source === key ? 'border-primary bg-primary/5' : 'border-border/70 hover:border-primary/40',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="h-4 w-4" /> {meta.label}
                    </span>
                    <span className="text-muted-foreground">{count} · {percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card variant="elevated" className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Actividad por tenant</CardTitle>
              {(brandId || localId) && (
                <Button type="button" variant="ghost" size="sm" onClick={resetScope}>Ver todos</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2">
              {(listQuery.data?.tenantActivity || []).map((tenant) => (
                <button
                  type="button"
                  key={tenant.localId}
                  onClick={() => {
                    setBrandId(tenant.brandId);
                    setLocalId(tenant.localId);
                    setPage(1);
                  }}
                  className={cn(
                    'min-w-[210px] snap-start rounded-2xl border p-4 text-left transition-all',
                    localId === tenant.localId
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border/70 bg-muted/20 hover:-translate-y-0.5 hover:border-primary/40',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary"><Building2 className="h-4 w-4" /></div>
                    <Badge variant="secondary">{tenant.sessions} chats</Badge>
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{tenant.brandName}</p>
                  <p className="truncate text-xs text-muted-foreground">{tenant.locationName} · {tenant.subdomain}</p>
                </button>
              ))}
              {!listQuery.isLoading && (listQuery.data?.tenantActivity.length || 0) === 0 && (
                <div className="flex min-h-28 w-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  No hay actividad en este periodo.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated" className="overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Conversaciones</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedTenant ? `${selectedTenant.brandName} · ${selectedTenant.locationName}` : 'Todos los tenants'}
              </p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Buscar mensaje, resumen o tenant..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="grid min-h-[580px] lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-border lg:border-b-0 lg:border-r">
            <ScrollArea className="h-[580px]">
              <div className="space-y-2 p-3">
                {listQuery.isLoading && Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />
                ))}
                {listQuery.data?.items.map((session) => {
                  const lastUserMessage = [...session.preview].reverse().find((message) => message.role === 'user');
                  return (
                    <button
                      type="button"
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition-colors',
                        selectedSessionId === session.id
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent bg-muted/25 hover:border-border hover:bg-muted/50',
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{session.brand.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{session.location.name} · {session.admin.name}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(session.lastMessageAt)}</span>
                      </div>
                      <p className="line-clamp-2 text-xs text-foreground/80">
                        {lastUserMessage?.content || session.summary || 'Conversación sin vista previa'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <SourceBadge source={lastUserMessage?.inputSource} templateKey={lastUserMessage?.templateKey} />
                        <span className="text-[10px] text-muted-foreground">{session.messageCount} mensajes</span>
                      </div>
                    </button>
                  );
                })}
                {!listQuery.isLoading && (listQuery.data?.items.length || 0) === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">No hay conversaciones con estos filtros.</div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between border-t border-border p-3">
              <span className="text-xs text-muted-foreground">Página {page}</span>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" disabled={!listQuery.data?.hasMore} onClick={() => setPage((value) => value + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="min-w-0 bg-muted/10">
            {detailQuery.isLoading ? (
              <div className="flex h-[580px] items-center justify-center text-sm text-muted-foreground">Cargando conversación...</div>
            ) : detailQuery.data ? (
              <div className="flex h-[580px] flex-col">
                <div className="border-b border-border bg-background/80 p-4 backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{detailQuery.data.brand.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {detailQuery.data.location.name} · {detailQuery.data.admin.name} · {detailQuery.data.admin.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-4 w-4" /> {formatDateTime(detailQuery.data.lastMessageAt)}
                    </div>
                  </div>
                  {detailQuery.data.summary && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
                      <span className="font-semibold text-primary">Resumen IA: </span>{detailQuery.data.summary}
                    </div>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-4 p-4 sm:p-6">
                    {detailQuery.data.messages.map((message) => (
                      <div key={message.id} className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {message.role === 'assistant' && (
                          <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
                        )}
                        <div className={cn(
                          'max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm',
                          message.role === 'user'
                            ? 'border-primary/30 bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground',
                        )}>
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
                              {message.role === 'user' ? 'Administrador' : 'Asistente'}
                            </span>
                            {message.role === 'user' && (
                              <SourceBadge source={message.inputSource} templateKey={message.templateKey} />
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                          <p className="mt-2 text-right text-[10px] opacity-60">{formatDateTime(message.createdAt)}</p>
                        </div>
                        {message.role === 'user' && (
                          <div className="mt-1 rounded-full bg-muted p-2 text-muted-foreground"><UserRound className="h-4 w-4" /></div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex h-[580px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MessageSquareText className="h-10 w-10" />
                <p className="text-sm">Selecciona una conversación para inspeccionarla.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PlatformAiConversations;
