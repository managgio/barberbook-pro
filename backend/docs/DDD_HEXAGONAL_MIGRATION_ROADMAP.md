# Migracion Backend a Hexagonal + DDD (Incremental, Sin Big Bang)

## Proposito
Este documento es la fuente de verdad operativa de la migracion.
Debe decir siempre:
- que tarea ya esta hecha,
- en que tarea estamos ahora,
- que sigue despues,
- por que ese orden.

## Regla Operativa Obligatoria (cada PR)
En cada PR de esta migracion hay que actualizar este archivo antes de mergear.

Checklist obligatorio:
- [ ] Actualizar `Estado Actual` (tarea completada y tarea en curso).
- [ ] Marcar checkboxes de `PRs Recomendados`.
- [ ] Actualizar `Riesgos Abiertos` si aplica.
- [ ] Actualizar `Decision Log` si se tomo una decision nueva.
- [ ] Si se cierra una fase, actualizar `Fases` y `Hitos`.

Plantilla de update por PR:
- PR: `PRx - <titulo>`
- Tarea completada: `<id + descripcion>`
- Evidencia verificable: `<tests/build/flag/logs/archivo>`
- Tarea actual: `<id + descripcion>`
- Siguiente tarea: `<id + descripcion>`

## Estado Actual
- Ultima actualizacion: **2026-03-07**
- Tarea completada:
  - `PR1`: scaffold inicial + facade strangler + flags + baseline tests en verde.
  - `PR2`: availability engine en dominio + unit tests de invariantes.
  - `PR3`: adapters read + modo `shadow` en facade + inventario automatico + guardrails base.
  - `PR4`: rollout `availability` single en `shadow` por defecto en staging (flags por capability).
  - `PR5`: rollout `availability-batch` y `weekly-load` en `shadow` por defecto en staging.
  - `PR6`: scaffold write path `create` con `CreateAppointmentUseCase` + puertos + bridges legacy.
  - `PR7`: create path y checkout Stripe alineados por `AppointmentsFacade` + `create v2` por defecto en staging.
  - `PR8`: scaffold write path `update/remove` con `UseCases + Commands + Ports + flags + bridges legacy`.
  - `PR9`: side effects de status extraidos a application (`RunAppointmentStatusSideEffectsUseCase`) + idempotencia lock-based.
  - `PR10`: jobs de booking (`status sync`/retention) migrados para invocar use cases del core.
  - `PR11`: extraction inicial de pricing core en `contexts/commerce` + adoption en booking.
  - `PR12`: subscriptions desacoplado por ports/adapters (ACL) en booking/loyalty/referrals.
  - `PR13-A`: ACL inicial loyalty + wallet/coupon en booking via ports de commerce.
  - `PR13-B`: politicas puras de loyalty/coupon movidas a `commerce/domain` y conectadas en servicios/adapters.
  - `PR13-C1`: `resolveRewardDecision` extraido a `commerce/application` + adapter Prisma en path de appointments.
  - `PR13-C2`: wallet/coupon booking path extraido a `commerce/application` + persistencia Prisma.
  - `PR14-A`: ACL de referral attribution en booking (port `engagement` + adapter puente legacy).
  - `PR14-B`: `resolve+attach attribution` extraidos a `engagement/application` con persistencia Prisma.
  - `PR14-C`: rewarding/cancel/completion flow extraido a `engagement/application` con puertos de reward/notificacion.
  - `PR15-A`: `payments` desacoplado del SDK Stripe via `CommerceStripePaymentGatewayPort` + adapter y contract tests.
  - `PR15-B`: `subscriptions` desacoplado del SDK Stripe usando el mismo `CommerceStripePaymentGatewayPort`.
  - `PR16`: notificaciones desacopladas de SDKs (Nodemailer/Twilio) via ports/adapters y contract tests.
  - `PR17-A`: AI tools desacoplados de `Appointments/Holidays/Alerts` via ACL ports/adapters legacy.
  - `PR17-B`: lecturas de AI tools desacopladas de Prisma directo en `AiToolsRegistry` via `AiToolsReadPort`.
  - `PR17-C`: `AiAssistantService`/`AiAssistantGuard` sin Prisma directo via `AiAdminAccessReadPort`.
  - `PR18-A`: tenant context explicito en AI (`service/guard`) via `TenantContextPort`.
  - `PR18-B`: `AiToolsRegistry` usa `TenantContextPort` (sin `getCurrent*` helpers).
  - `PR18-C1`: `FirebaseAdminService` migra a `TenantContextPort` (sin `getCurrentBrandId`).
  - `PR18-C2`: modulo `users` migra a `TenantContextPort` (sin `getCurrent*` helpers).
  - `PR18-C3A`: bloque platform/admin (`observability`, `usage-metrics`, `audit-logs`, `admin-guard`, `payments/referrals admin controllers`) migra a `TenantContextPort`.
  - `PR18-C4A`: `notifications/reminders` migran a `TenantContextPort` (sin `getCurrentBrandId/getCurrentLocalId`).
  - `PR18-C4B`: CRUD low-risk (`alerts`, `roles`, `service-categories`, `product-categories`, `holidays`, `schedules`) migra a `TenantContextPort`.
  - `PR18-C4C`: `client-notes` y `settings` migran a `TenantContextPort`.
  - `PR18-C4D`: `reviews` (`config/request/analytics`) migra a `TenantContextPort`.
  - `PR18-C4E`: `services/products/offers` migran a `TenantContextPort` y `services.utils/products.utils` pasan a scope explicito.
  - `PR18-C4F`: `barbers` y `cash-register` migran a `TenantContextPort`.
  - `PR18-C4G`: `ai-memory` e `imagekit` migran a `TenantContextPort`.
  - `PR18-C4H`: `referral-code`, `referral-config` y `referrals.scheduler` migran a `TenantContextPort`.
  - `PR18-C4I`: `referral-attribution` y `rewards` migran a `TenantContextPort` (incluye ajuste de tests).
  - `PR18-C4J`: `loyalty` migra a `TenantContextPort`.
  - `PR18-C4K`: `legal` migra a `TenantContextPort`.
  - `PR18-C4L`: `subscriptions`, `payments` y `appointments` migran a `TenantContextPort` (sin `getCurrent*` en `modules/*`).
  - `PR18-C5A`: `payments` deja de usar `runWithTenantContextAsync` directo via `TenantContextRunnerPort`.
  - `PR18-C5B1`: `tenant-config`, `tenant.controller` y `tenant-prisma` migran a `TenantContextPort`.
  - `PR18-C5B2`: iteracion de locales activos e indicador platform pasan a ports/adapters (`ACTIVE_LOCATION_ITERATOR_PORT` + `TenantContextPort`), eliminando `tenant.utils`.
  - `PR19-A1`: `tenant.context` reduce API publica (sin `getCurrent*`/`isPlatformRequest`); defaults de tenant resueltos en adapter ALS.
  - `PR19-A2`: `TenantPrismaService` encapsula `scopeGuardBypass` via port (`TENANT_SCOPE_GUARD_BYPASS_PORT`).
  - `PR19-B1`: contratos operativos cross-tenant para jobs via `runTenantScopedJob` + métricas agregadas por local.
  - `PR19-B2`: umbrales operativos en jobs (`failureRate` + `failedLocations`) con alertas `warn` estandarizadas por `runId`.
  - `PR19-C1`: `AppModule` consume adapters de bootstrap para middleware/guard global (`TenantContextMiddleware`, `AdminGlobalGuard`).
  - `PR19-C2`: `TenancyModule` deja de exportar/proveer `TenantMiddleware`; el wiring global queda en bootstrap.
  - `PR19-C3`: documentación de frontera bootstrap/tenancy actualizada (`README` de bootstrap, guards, middleware).
  - `PR20-A`: inventario automatizado de artefactos transicionales (`legacy-bridge`, `legacy-adapter`, `flag-alias`) + checklist generado.
  - `PR20-B`: gate de enforcement en CI para checklist transicional (`--check`) + comando agregador `migration:gate:ci`.
  - `PR20-C1`: eliminación de aliases legacy de flags (`BOOKING_AVAILABILITY_MODE/BOOKING_CREATE_MODE/BOOKING_UPDATE_MODE/BOOKING_REMOVE_MODE`) en `appointments.flags`.
  - `PR20-C2A`: eliminación de `legacy-commerce-loyalty-policy.adapter` (sin wiring activo) + actualización de checklist transicional.
  - `PR20-C2B`: eliminación de `legacy-commerce-wallet-ledger.adapter` (sin wiring activo) + retiro de test dedicado al adapter.
  - `PR20-C3A`: reemplazo de `legacy-booking-unit-of-work.adapter` por `NoopBookingUnitOfWorkAdapter` (mismo comportamiento, sin etiqueta legacy).
  - `PR20-C3B`: reemplazo de adapters legacy de booking (`command/maintenance/side-effects`) por adapters no-legacy equivalentes.
  - `PR20-C3C`: eliminación de `appointments.legacy.service` y consumo directo de `AppointmentsService` desde `AppointmentsFacade`.
  - `PR20-C4`: reemplazo de adapters legacy restantes (`commerce-subscription`, `engagement-referral-*`, `ai-tools`) por adapters no-legacy.
  - `PR20-D1`: gate CI endurecido para exigir `Present: 0` en artefactos transicionales (`--require-zero-present`).
  - `PR21-A1`: deduplicación de providers `TENANT_CONTEXT_PORT` en módulos que ya importan `TenancyModule` (`appointments`, `ai-assistant`, `loyalty`, `referrals`).
  - `PR21-B1`: consolidación de wiring de `COMMERCE_SUBSCRIPTION_POLICY_PORT` en módulo compartido (`CommerceSubscriptionPolicyModule`).
  - `PR21-C1`: hardening DI en adapters factory-based (`Stripe/Nodemailer/Twilio`) para evitar resolución de token `Function` en Nest (`@Optional` + default factory interno).
  - `PR21-C2`: deduplicación masiva de wiring `TENANT_CONTEXT_PORT` en módulos con `TenancyModule` + retiro de wiring local `TENANT_CONTEXT_RUNNER_PORT` en `payments`.
  - `PR21-E`: eliminación total de wiring local `TENANT_CONTEXT_PORT` en `modules/*`; resolución centralizada en `TenancyModule`.
  - `PR21-D`: normalización de provider modules compartidos para puertos cross-context (`CommerceStripePaymentGatewayModule`, `EngagementNotificationGatewayModule`).
  - `PR22-A`: smoke runtime con DB real validado (arranque completo Nest + conectividad Prisma); incidencia local detectada: `EADDRINUSE` en puerto `3000`.
  - `PR22-B`: smoke runtime automatizado por capabilities críticas (`availability/create/checkout/notifications`) con script reproducible y validación verde.
  - `PR22-C`: hardening operacional cerrado (preflight DB+puerto + `start:dev` con auto-fallback de puerto + smoke repetible unificado).
  - `PR23-A`: smoke autenticado mínimo cerrado (`AUTH_DEV_BYPASS` local no-prod + script reproducible `migration:smoke:runtime:auth` + tests unitarios).
  - `PR23-B`: smoke de paridad `legacy vs v2` cerrado para booking read (`migration:smoke:runtime:parity` con normalización de payload y comparación estructural).
  - `PR24-A`: fixtures tenant-aware para smoke/paridad (`x-local-id`/`x-tenant-subdomain` + `TENANT_ALLOW_HEADER_OVERRIDES=true`) con señal funcional `2xx` en endpoints críticos.
  - `PR24-B`: gate opcional de release implementado (`migration:gate:release`) con umbrales explícitos (`minPassRate` y `maxFailedChecks`) y modo enforce reproducible.
  - `PR24-C`: smoke autenticado con payload válido en write-path (`create` 201 real + `checkout` válido con fallback `SKIP` cuando Stripe no está disponible).
  - `PR24-D`: política de activación por entorno + rollback operacional documentados y ejecutables (`staging/canary/prod`).
  - `PR24-E`: `runtime-capability-smoke` elevado a flujo tenant-aware con señal `2xx` real en capacidades base (`bootstrap/availability/create/payments`).
  - `PR24-F`: gate de release endurecido para exigir cobertura no-skip en checkout cuando el entorno declara Stripe operativo.
  - `PR25-A`: primer vertical CRUD migrado a estructura target (`roles` en `contexts/identity`: use-cases + port + adapter Prisma + tests unitarios).
  - `PR25-B`: `alerts` + `service-categories` migrados al patrón target (`contexts/engagement` y `contexts/commerce`) con use-cases, puertos, adapters Prisma y tests.
  - `PR25-C`: wiring HTTP/adapters consolidado en CRUD migrados + smoke autenticado de regresión por capability (`roles/alerts/service-categories`) en verde.
  - `PR25-D`: `product-categories` + `client-notes` migrados al patrón target (`contexts/commerce` y `contexts/engagement`) con use-cases, puertos, adapters Prisma y tests.
  - `PR25-E`: smoke autenticado extendido con CRUD `product-categories/client-notes` (con `SKIP` explícito en client-notes si falta fixture de cliente).
  - `PR26-A`: `holidays` + `schedules` migrados al patrón target (`contexts/booking`) con use-cases, puertos, adapters Prisma y tests.
  - `PR26-B`: smoke autenticado ampliado con capacidades CRUD de `holidays/schedules` en verde.
  - `PR27-A`: `users` read-path migrado a `contexts/identity` (queries/use-cases + `IDENTITY_USER_READ_PORT` + adapter Prisma tenant-scoped), manteniendo API HTTP sin cambios.
  - `PR27-B`: smoke autenticado extendido con capacidades `users` (`self`, `by-email self`, `admin list`) para regresión operacional del read-path migrado.
  - `PR27-C`: `users` write-path migrado a `contexts/identity` (`create/update/block/remove`) con `IDENTITY_USER_WRITE_PORT`, adapter Prisma y bridge de side effect externo (`IDENTITY_AUTH_USER_PORT` -> Firebase).
  - `PR28-A`: `barbers` read/list migrado a `contexts/booking` (queries/use-cases + `BOOKING_BARBER_DIRECTORY_READ_PORT` + adapter Prisma tenant-scoped), manteniendo API HTTP sin cambios.
  - `PR28-B`: smoke autenticado extendido con capacidades `barbers` (`list`, `by-id`, `admin list`) para regresión operacional del read-path migrado.
  - `PR28-C`: `barbers` write-path migrado a `contexts/booking` (`create/update/service-assignment/remove`) con `BOOKING_BARBER_MANAGEMENT_PORT` + `BOOKING_BARBER_PHOTO_STORAGE_PORT`, adapter Prisma y adapter ImageKit.
  - `PR29-A`: `services/products/offers` read-path migrado a `contexts/commerce` (queries/use-cases + puertos read + adapters Prisma tenant-scoped), manteniendo API HTTP sin cambios.
  - `PR29-B`: smoke autenticado extendido con capacidades commerce-read (`services/products/offers`) para regresión operacional del vertical migrado.
  - `PR29-C`: write-path de `services` migrado a `contexts/commerce` (`create/update/remove`) con commands/use-cases + `COMMERCE_SERVICE_MANAGEMENT_PORT` + adapter Prisma.
  - `PR29-D`: smoke autenticado extendido con capacidades `services` write (`create/update/delete`) para regresión operacional del vertical.
  - `PR30-A`: write-path de `products` migrado a `contexts/commerce` (`create/update/remove/import`) con commands/use-cases + `COMMERCE_PRODUCT_MANAGEMENT_PORT` + adapter Prisma + adapter ImageKit.
  - `PR30-B`: smoke autenticado extendido con capacidades `products` write (`create/update/delete`) para regresión operacional del vertical.
  - `PR31-A`: write-path de `offers` migrado a `contexts/commerce` (`create/update/remove`) con commands/use-cases + `COMMERCE_OFFER_MANAGEMENT_PORT` + adapter Prisma.
  - `PR31-B`: smoke autenticado extendido con capacidades `offers` write (`create/update/delete`) para regresión operacional del vertical.
  - `PR32-A`: helpers de pricing/settings movidos a `contexts/commerce/infrastructure/prisma/support` para eliminar imports de `modules/services|products|settings` en adapters Prisma de commerce.
  - `PR32-B`: validación de regresión de PR32-A cerrada (`build`, `arch:check`, tests de paridad support helpers, `migration:smoke:runtime:auth`, `migration:smoke:runtime:parity` en verde).
  - `PR33-A`: helpers de schedule movidos a `contexts/booking/infrastructure/prisma/support` + desacople de `SettingsService` fuera de `booking/infrastructure/prisma` via `BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT`.
  - `PR33-B`: validación de regresión de PR33-A cerrada (`build`, `arch:check`, tests booking/paridad de support helpers, `migration:smoke:runtime:auth`, `migration:smoke:runtime:parity` en verde).
  - `PR34-A`: inventario automático de bridges no-legacy `contexts/* -> modules/*` generado y versionado (`context-module-bridges-inventory.md` + script npm).
  - `PR34-B1`: primer recorte de acoplamiento `booking -> appointments` en `appointments-booking-command.adapter` (sin imports de DTO legacy; inventario de bridges baja de 18 a 16).
  - `PR34-B2`: eliminación de dependencia directa de `AppointmentsService` en adapters de `contexts/booking` (`command/maintenance`) moviendo bridge a `modules/appointments/adapters` (inventario baja de 16 a 14).
  - `PR34-C1`: desacople de bridge `commerce -> subscriptions` moviendo adapter/module de policy a `modules/subscriptions` (inventario baja de 14 a 12).
  - `PR34-C2`: desacople de bridges `engagement -> modules/*` moviendo adapters de reward/notification/persistence a `modules/referrals|notifications` (inventario baja de 12 a 9).
  - `PR34-C3`: desacople de bridges `identity` y `ai-orchestration` moviendo adapters a `modules/users|ai-assistant` (inventario baja de 9 a 5).
  - `PR34-C4`: desacople de bridges residuales en `booking/commerce` (`reviews|settings|imagekit`) moviendo adapters a `modules/appointments|barbers|products` (inventario baja de 5 a 0).
  - `PR34-D`: hardening de fronteras: `arch:check` bloquea explícitamente cualquier `contexts/* -> modules/*`.
  - `PR35-A`: limpieza documental cerrada (roadmap sin links rotos a adapters eliminados/movidos; referencias históricas normalizadas).
  - `PR35-B`: hardening de gates Fase 9: `migration:gate:ci` exige también `context-module-bridges:enforce-zero` y `release-gate` ejecuta CI-guards previos (`arch`, `transition-artifacts`, `context-module-bridges`) antes de smokes runtime.
  - `PR35-C`: cierre documental post-migración (`ADR-0009` + actualización de índices/readmes) con regla explícita `contexts/*` sin imports a `modules/*`.
  - `PR35-D`: retiro de modos transicionales `legacy/shadow` en booking (`appointments.flags` fijo en `v2`, `appointments.facade` sin fallback legacy/shadow, eliminación de `shadow-diff`, parity smoke en `SKIP` explícito por desactivación de modo legacy).
  - `PR36-A`: hardening final de release gate por perfil (`checks=runtime,auth` en `staging/canary/prod`) + evidencia operativa local de `migration:gate:release:staging` en verde.
  - `PR36-B`: evidencia operativa final cerrada (`migration:gate:release:canary` y `migration:gate:release:prod` en verde, checkout coverage no-skip con `201` en runtime/auth).
  - `PR36-C`: cierre administrativo de Fase 9 y declaración formal de estado target (criterios DoD permanentes documentados y validados).
  - `PR37-A`: housekeeping post-migración cerrado (parity smoke reducido a `SKIP` liviano, baseline de mantenimiento en npm scripts y limpieza de referencias obsoletas en roadmap/policy).
  - `PR37-B`: optimización de coste/tiempo de gates cerrada (`*:fast` sin CI-guards redundantes tras `gate:ci` + bundle `canary-prod` con un único `build+preflight`).
  - `PR37-C`: priorización automática de deuda técnica residual en `src/modules/*` cerrada (`migration:inventory:residual-debt` + reporte versionado en `docs/migration/residual-debt-prioritization.md`).
  - `PR38-A`: primer recorte vertical de mantenimiento continuo (`cash-register` migrado a `contexts/commerce` con `port + use-cases + adapter Prisma`, tests unitarios y caída de prioridad residual `P0 -> P3`).
  - `PR38-B`: segundo recorte vertical en `usage-metrics` (`PlatformUsageMetricsPort` + use cases en `contexts/platform` + adapter Prisma/TenantConfig en módulo), reduciendo acoplamiento del service Nest a fachada de aplicación.
  - `PR38-C`: cobertura smoke auth ampliada para capacidad platform (`GET /api/platform/metrics`) con `SKIP` explícito cuando no hay actor `isPlatformAdmin` y validación `PASS [200]` en `migration:smoke:runtime:auth`.
  - `PR38-D`: tercer recorte vertical en `observability` (`PlatformObservabilityPort` + use cases en `contexts/platform` + adapter `in-memory/prisma`), dejando `ObservabilityService` como fachada sin Prisma/Nodemailer/locks.
  - `PR38-E`: smoke auth ampliado con capacidades `auth.platform.observability.web-vitals` y `auth.platform.observability.api` (`PASS [200]`) + suite de use cases platform observability.
  - `PR39-A`: cuarto recorte vertical en `platform-admin` (`PlatformAdminManagementPort` + adapter Prisma/ImageKit + fachada `PlatformAdminService` sin Prisma/SDKs), manteniendo API `/api/platform/*`.
  - `PR39-B`: smoke auth ampliado con capacidades `auth.platform.brands.list` y `auth.platform.brand.health` (`PASS [200]`) y cobertura de facade en tests unitarios.
  - `PR40-A`: quinto recorte vertical en `subscriptions` (`CommerceSubscriptionManagementPort` + adapter Prisma/Stripe + fachada `SubscriptionsService` sin Prisma/TenantConfig/Stripe directos), manteniendo API `/api/subscriptions/*`.
  - `PR40-B`: validación operacional del vertical `subscriptions` (`build`, `arch:check`, tests de fachada/policy adapter y `migration:smoke:runtime:auth` en verde con `auth.subscriptions.me*` y `auth.admin.subscriptions.plans` en `PASS [200]`).
  - `PR41-A`: sexto recorte vertical en `notifications` (`EngagementNotificationManagementPort` + adapter settings/tenant/twilio/email + fachada `NotificationsService` sin acoplamiento directo a infra), manteniendo API `/api/notifications/*`.
  - `PR41-B`: validación operacional del vertical `notifications` (`build`, `arch:check`, tests de fachada/factory adapters y `migration:smoke:runtime:auth` en verde con nuevos checks `auth.admin.notifications.test-sms|test-whatsapp` en `PASS [400]` esperado).
  - `PR42-A`: séptimo recorte vertical en `loyalty` (`CommerceLoyaltyManagementPort` + adapter Prisma/subscription-policy + fachada `LoyaltyService` sin Prisma/TenantConfig directos), manteniendo API `/api/loyalty/*`.
  - `PR42-B`: validación operacional del vertical `loyalty` (`build`, `arch:check`, tests de fachada/policy y `migration:smoke:runtime:auth` en verde con checks nuevos `auth.loyalty.programs.active` y `auth.admin.loyalty.programs` en `PASS [200]`).
  - `PR43-A`: octavo recorte vertical en `referrals` (fase 1: `ReferralAttributionService` a `EngagementReferralAttributionManagementPort` + adapter Prisma/config/rewards/notifications + fachada delgada), manteniendo API `/api/referrals/*` y `/api/admin/referrals/*`.
  - `PR43-B`: validación operacional de `referrals` fase 1 (`build`, `arch:check`, tests `referral-anti-fraud/referral-rewarding/referral-attribution-management.facade` y `migration:smoke:runtime:auth` en verde con check nuevo `auth.admin.referrals.list` en `PASS [200]`).
  - `PR44-A`: noveno recorte vertical de `referrals` fase 2 (`ReferralConfigService` y `RewardsService` pasan a facades por puerto; adapters Prisma dedicados `config/reward` conectados en `ReferralsModule`), manteniendo API `/api/referrals/*`, `/api/rewards/*` y `/api/admin/referrals/*`.
  - `PR44-B`: validación operacional de `referrals` fase 2 cerrada (`build`, `arch:check`, tests `referral-*` incluyendo nuevas facades `config/reward`, `migration:smoke:runtime:auth` en verde con check nuevo `auth.admin.referrals.config` en `PASS [200]`, inventario residual regenerado con `referrals` bajando a `P1`).
  - `PR45-A1`: `ai-assistant` extrae políticas de conversación a `contexts/ai-orchestration/domain` (intent policy + response policy + tipos compartidos), dejando `AiAssistantService` más delgado y sin helpers de parsing/formateo embebidos.
  - `PR45-A2`: `ai-assistant` extrae orquestación principal a `contexts/ai-orchestration/application` (`chat/get-session/transcribe` use cases + puertos `memory/tools/tenant-ai-config/llm/usage-metrics` + adapters), dejando `AiAssistantService` como fachada/adaptador.
  - `PR45-B`: validación operacional de `ai-assistant` cerrada (`build`, `arch:check`, tests de IA incluyendo `ai-assistant.usecases`, `migration:smoke:runtime:auth`, `migration:gate:ci`) con caída de prioridad residual `P0 -> P1`; inventario actualizado (`P0=1`, `ai-assistant` score 14->10, LOC 980->393).
  - `PR46-A1`: `appointments` read query path (`findPage`, `findPageWithClients`, `findRangeWithClients`) extraído a `contexts/booking/application` con `BOOKING_APPOINTMENT_QUERY_PORT` + adapter Prisma y tests de use case.
  - `PR46-A2`: `appointments` `findOne` migrado a `FindAppointmentByIdUseCase` (sync previo de estado vía `BookingMaintenancePort`) y `anonymize` de facade migrado al `AnonymizeAppointmentUseCase`; métodos read legacy eliminados de `AppointmentsService` (`findPage*`, `findRangeWithClients`, `findOne`) y LOC residual de `appointments` reducido (`2069 -> 1920`).
  - `PR46-A3`: `appointments` `dashboard-summary` migrado a `contexts/booking` (`GetBookingDashboardSummaryUseCase` + `BookingDashboardReadPort` + `booking-dashboard-summary.policy` de dominio + adapter Prisma); `AppointmentsFacade` deja de usar `AppointmentsService` para este endpoint y `AppointmentsService` elimina toda la lógica de dashboard legacy.
  - `PR46-A4a`: `appointments` write `remove` migrado fuera de `AppointmentsService` a `ModuleBookingCommandAdapter` con Prisma + `RunAppointmentStatusSideEffectsUseCase` + audit log; `AppointmentsService` elimina método legacy `remove`, manteniendo comportamiento transaccional y side-effects.
  - `PR46-A4b`: `appointments` maintenance write (`anonymize` + `syncStatusesForAll/ByIds`) migrado fuera de `AppointmentsService` a `ModuleBookingMaintenanceAdapter` con Prisma + `RunAppointmentStatusSideEffectsUseCase` + audit log; `AppointmentsService` elimina métodos legacy de mantenimiento y reduce acoplamiento.
  - `PR46-A4c`: eliminación de fallbacks legacy en `AppointmentsFacade` para `availability-batch`/`weekly-load` + eliminación de métodos legacy equivalentes en `AppointmentsService` (`getAvailableSlotsBatch`, `getWeeklyLoad`), dejando esos paths exclusivamente en use cases `contexts/booking`.
  - `PR46-A4d`: `sendPaymentConfirmation` migra de `AppointmentsService` a `contexts/booking` (`SendAppointmentPaymentConfirmationUseCase` + `BookingMaintenancePort`) y se implementa en `ModuleBookingMaintenanceAdapter` con Prisma + Notifications; se elimina método legacy del service.
  - `PR46-A4e`: reglas de `update` (transiciones de estado, ventana de completion, cutoff de cancelación, permisos admin) extraídas a `contexts/booking/domain/services/update-appointment-policy.ts` con tests de dominio; `AppointmentsFacade` elimina dependencia directa residual de `AppointmentsService`.
  - `PR46-A4f1`: eliminación del engine legacy de disponibilidad residual en `AppointmentsService` (`computeAvailableSlotsForBarber`, `resolveEndOverflow*`, `getAvailableSlots`) al quedar `assertSlotAvailable` 100% en `GetAvailabilityUseCase`; limpieza de dependencias legacy (`HolidaysService`, `schedule.utils`, `schedule.types`) y validación completa (`build` + `npm test -- --runInBand` + regeneración de inventario residual).
  - `PR46-A4f2`: `updateAppointment` deja de ejecutarse en `AppointmentsService` y se migra a `ModuleBookingCommandAdapter` (orquestación completa write con pricing/stock/transacciones/side-effects), eliminando el método `update` legacy en service y manteniendo `UpdateAppointmentUseCase` + `BookingCommandPort` como entrypoint.
  - `PR46-A4f3`: `createAppointment` migra de `AppointmentsService` a `ModuleBookingCommandAdapter` (consentimiento/legal, pricing, loyalty/subscription, wallet/coupon, referral attribution, transacción `SERIALIZABLE`, side-effects y notificaciones), y se elimina `AppointmentsService` del módulo/runtime.
  - `PR46-B`: recorte residual de jobs `appointments` para evitar Prisma directo en services (`appointments-retention` usa `BookingMaintenancePort.findAppointmentsForAnonymization`), cerrando inventario residual sin `P0` (`P0=0`, `appointments` pasa a `P3`).
  - `PR47-A`: `payments` mueve transiciones webhook/cancelación (`checkout completed/expired`, `payment_intent succeeded/failed`, `expired payment cleanup`) a `contexts/commerce/application` con `ProcessStripeWebhookUseCase` + `COMMERCE_PAYMENT_LIFECYCLE_PORT` + adapter Prisma, dejando `PaymentsService` como fachada/orquestador.
  - `PR47-B1`: `runtime-authenticated-smoke` amplía cobertura del vertical `payments` con checks explícitos `auth.payments.availability`, `auth.admin.payments.stripe.config` y `auth.payments.webhook.invalid-body` para validar superficie post-recorte sin depender de Stripe operativo.
  - `PR47-C`: `payments` mueve la orquestación restante de checkout/configuración Stripe fuera de `PaymentsService` a `contexts/commerce/application` (`ManageOnlinePaymentsUseCase`) + `COMMERCE_PAYMENT_MANAGEMENT_PORT` con adapter Prisma (`PrismaStripePaymentManagementAdapter`), dejando el service Nest como fachada sin Prisma/TenantConfig/AppointmentsFacade/Stripe directos.
  - `PR48-A`: `reviews` migra a patrón target (`ENGAGEMENT_REVIEW_MANAGEMENT_PORT` + `ManageReviewsUseCase` + `PrismaReviewManagementAdapter`), eliminando Prisma directo de `review-request/config/analytics` y dejando services Nest como fachadas.
  - `PR48-B`: smoke/auth amplía cobertura de `reviews` con capacidades `auth.reviews.pending`, `auth.admin.reviews.config` y `auth.admin.reviews.metrics`.
  - `PR49-A`: `referrals` completa recorte Prisma-heavy restante en services (`ReferralTemplatesService`, `ReferralCodeService`, `ReferralsSchedulerService`) mediante `use-cases + ports + adapters` (`template/code/maintenance`), manteniendo contratos HTTP y jobs sin cambios funcionales.
  - `PR50-A`: `legal` migra a patrón target (`PLATFORM_LEGAL_MANAGEMENT_PORT` + `ManageLegalSettingsUseCase` + `PrismaPlatformLegalManagementAdapter`), eliminando Prisma directo de `LegalService` y manteniendo contratos HTTP/consent sin cambios.
  - `PR51-A`: `ai-assistant` migra persistencia de memoria/cleanup a `contexts/ai-orchestration/infrastructure/prisma` (`PrismaAiAssistantMemoryAdapter`, `PrismaAiAssistantMemoryMaintenanceAdapter`) con puertos explícitos, eliminando Prisma directo en `AiMemoryCleanupService` y retirando `AiMemoryService` legacy.
  - `PR52-A`: `barbers` elimina Prisma directo de `BarbersService` delegando compatibilidad/elegibilidad a `BARBER_ELIGIBILITY_READ_PORT` (`PrismaBarberEligibilityReadAdapter`), manteniendo contratos HTTP y validaciones de negocio.
  - `PR53-A`: `settings` migra a patrón target (`PLATFORM_SETTINGS_MANAGEMENT_PORT` + `ManagePlatformSettingsUseCase` + `PrismaPlatformSettingsManagementAdapter`), eliminando Prisma directo de `SettingsService` y preservando el contrato de `SiteSettings`.
  - `PR54-A`: `imagekit` migra a patrón target (`PLATFORM_MEDIA_MANAGEMENT_PORT` + `ManagePlatformMediaUseCase` + `PrismaPlatformImageKitManagementAdapter`), eliminando Prisma directo de `ImageKitService` y manteniendo contratos de firma/borrado usados por `platform-admin`, `barbers` y `products`.
  - `PR55-A`: `notifications/reminders` migra a patrón target (`ENGAGEMENT_NOTIFICATION_REMINDER_PORT` + `RunNotificationRemindersUseCase` + `PrismaEngagementNotificationReminderAdapter`), eliminando Prisma directo de `RemindersService` y manteniendo cron/lock/multi-tenant sin cambios funcionales.
  - `PR56-A`: `audit-logs` migra a patrón target (`PLATFORM_AUDIT_LOG_MANAGEMENT_PORT` + `ManagePlatformAuditLogsUseCase` + `PrismaPlatformAuditLogManagementAdapter`), eliminando Prisma directo de `AuditLogsService` y manteniendo contratos de listado/log consumidos por `appointments` y `legal`.
  - `PR57-C`: cierre de backlog `P3` pendiente por acoplamientos reales (`service-to-service/utils`) con puertos compartidos (`TENANT_CONFIG_READ_PORT`, `DISTRIBUTED_LOCK_PORT`) y desacople de `appointments-retention` respecto a `LegalService` y `ai-assistant.utils`.
  - `PR57-B`: evidencia operativa cerrada con `migration:smoke:runtime:auth` y release gates `staging/canary/prod` en verde (perfiles `:fast`) tras corregir wiring de `PLATFORM_LEGAL_MANAGEMENT_PORT`.
  - `PR58-A`: auditoría de salud/eficiencia institucionalizada en `docs/analytics/BACKEND_HEALTH_AUDIT.md` con baseline, checklist periódico, umbrales y plantilla de histórico.
- Tarea en curso:
  - `PR58-B`: monitoreo post-migración y mantenimiento incremental (sin prioridades abiertas en backlog residual).
- Siguiente tarea:
  - `PR58-C`: automatizar captura periódica de métricas de auditoría (pipeline/reporting) para comparativa temporal sin intervención manual.

## Norte Arquitectonico (no negociable)
- `domain` no importa Nest/Prisma/SDK externos.
- Todo IO externo entra por `ports`.
- `application` orquesta casos de uso e invariantes, sin dependencias de framework.
- Nest controllers son adapters (DTO HTTP <-> command/query).
- Multi-tenant entra por `RequestContext` y se propaga explicitamente.
- Migracion por strangler + feature flags, sin big bang.

## Orden de Migracion (ROI/Riesgo)
1. Booking read (`availability`, `availability-batch`, `weekly-load`).
2. Booking write (`create`, `update/cancel/complete/remove`).
3. Commerce pricing core.
4. Subscriptions + loyalty + wallet/referrals.
5. Integraciones externas por adapters.
6. Platform/tenancy desacoplado.
7. CRUD simples.
8. Cleanup final.

Razon:
- primero el nucleo que impacta reservas/ingresos,
- luego transaccionalidad y side effects,
- despues modulos de menor riesgo.

## Fases y Hitos
- Fase 0 (S): guardrails + strangler shell + baseline.
- Fase 1 (M): availability read en core nuevo.
- Fase 2 (L): create appointment write path.
- Fase 3 (L): update/cancel/complete/remove + jobs.
- Fase 4 (M): pricing core en Commerce.
- Fase 5 (L): subscriptions/loyalty/wallet/referral.
- Fase 6 (M): Stripe/Twilio/OpenAI/ImageKit/Firebase via ports.
- Fase 7 (M): tenancy/security desacoplado.
- Fase 8 (M): CRUD simples.
- Fase 9 (S): cleanup legacy + hardening.

## Estado Global (post PR36-C)
- Fase 0-9: cerradas.
- Core DDD/Hexagonal activo en producción lógica (`contexts/*` + puertos/adapters).
- Guardrails permanentes activos:
  - `arch:check` bloquea imports inválidos,
  - `migration:gate:ci` exige `transition-artifacts=0` y `context-module-bridges=0`,
  - `release-gate` por perfil (`staging/canary/prod`) con checks `runtime,auth` y cobertura checkout en canary/prod.
- Booking sin modos transicionales (`legacy/shadow` retirados; ejecución fija `v2`).

## PRs Recomendados (tracking)
- [x] PR1: scaffold `contexts/shared/bootstrap` + `appointments.facade` + flags + baseline tests.
- [x] PR2: availability engine domain + unit tests P0.
- [x] PR3: prisma adapters read + parity tests + shadow en staging.
- [x] PR4: rollout `availability` single en `shadow` por defecto (staging).
- [x] PR5: rollout `availability-batch` y `weekly-load` en `shadow` por defecto (staging).
- [x] PR6: `CreateAppointmentUseCase` + ports write + bridges legacy.
- [x] PR7: switch `POST /appointments` + compatibilidad checkout.
- [x] PR8: `Update/Cancel/Complete/Remove` use cases.
- [x] PR9: switch `PATCH/DELETE` + side effects handlers.
- [x] PR10: migrar cron status sync/retention.
- [x] PR11: extraction pricing core en Commerce.
- [x] PR12: subscriptions ports/adapters.
- [x] PR13: loyalty + wallet/coupon ledger core.
- [x] PR14: referral attribution/reward core.
- [x] PR15: Stripe adapters + webhook contract tests.
- [x] PR16: notifications adapters (Twilio/Email).
- [x] PR17: AI orchestration via ports.
- [x] PR18: request context explicito + reducir ALS.
- [x] PR19: tenancy platform extraction + contrato explicito para jobs/webhooks.
- [x] PR20: cleanup final + enforcement CI.
- [x] PR21: normalizacion final de wiring compartido + hardening DI.
- [x] PR22: hardening operacional runtime (`preflight`, `smoke`, auto-port fallback).
- [x] PR23: smoke autenticado + paridad runtime `legacy vs v2`.
- [x] PR24-A: fixtures `2xx` tenant-aware para smoke/paridad.
- [x] PR24-B: gate opcional de release para smoke/paridad.
- [x] PR24-C: write-path válido en smoke autenticado (`create` real + `checkout` condicional).
- [x] PR24-D: política de activación por entorno del release gate + rollback operacional.
- [x] PR24-E: elevar runtime smoke base a señal `2xx` tenant-aware en capabilities seleccionadas.
- [x] PR24-F: endurecer gate de release en checkout para entornos con Stripe declarado operativo.
- [x] PR25-A: migrar `roles` a `contexts/identity` (use-cases + port + adapter Prisma + tests).
- [x] PR25-B: migrar `alerts` y `service-categories` al patrón target.
- [x] PR25-C: consolidar wiring HTTP/adapters en CRUD migrados y cerrar smoke de regresión por capability.
- [x] PR25-D: migrar `product-categories` y `client-notes` al patrón target.
- [x] PR25-E: extender smoke autenticado para CRUD `product-categories/client-notes`.
- [x] PR26-A: migrar `holidays` y `schedules` al patrón target.
- [x] PR26-B: extender smoke autenticado para CRUD `holidays/schedules`.
- [x] PR27-A: iniciar migración de `users` a `contexts/identity` (read/list + puertos + adapter Prisma).
- [x] PR27-B: extender smoke autenticado con capacidades `users` (self + admin paths).
- [x] PR27-C: migrar `users` write-path (`create/update/block/remove`) a `contexts/identity`.
- [x] PR28-A: migrar `barbers` read/list al patrón target (`contexts/booking`).
- [x] PR28-B: extender smoke autenticado con capacidades `barbers` (list/by-id/admin list).
- [x] PR28-C: migrar `barbers` write-path (`create/update/service-assignment/remove`) al patrón target (`contexts/booking`).
- [x] PR29-A: migrar `services/products/offers` read-path al patrón target (`contexts/commerce`).
- [x] PR29-B: extender smoke autenticado con capacidades `services/products/offers` migradas para cerrar regresión operacional del vertical commerce-read.
- [x] PR29-C: migrar write-path de `services` (`create/update/remove`) al patrón target (`contexts/commerce`).
- [x] PR29-D: extender smoke autenticado con capacidades write de `services` para regresión operacional del vertical.
- [x] PR30-A: migrar write-path de `products` (`create/update/remove/import`) al patrón target (`contexts/commerce`).
- [x] PR30-B: extender smoke autenticado con capacidades write de `products` para regresión operacional del vertical.
- [x] PR31-A: migrar write-path de `offers` (`create/update/remove`) al patrón target (`contexts/commerce`).
- [x] PR31-B: extender smoke autenticado con capacidades write de `offers` para regresión operacional del vertical.
- [x] PR32-A: mover helpers de pricing/settings a `contexts/commerce` para eliminar imports desde `modules/*` en adapters de infraestructura.
- [x] PR32-B: validar regresión de PR32-A (tests de paridad support + smoke runtime auth/parity) y cerrar evidencias.
- [x] PR33-A: mover helpers de schedule/settings a `contexts/booking` para eliminar imports desde `modules/*` en adapters Prisma de booking.
- [x] PR33-B: validar regresión de PR33-A (tests de paridad support + smoke runtime auth/parity) y cerrar evidencias.
- [x] PR34-A: inventario + priorización de bridges no-legacy `contexts/* -> modules/*` y definición de lote incremental de eliminación.
- [x] PR34-B1: desacoplar `appointments-booking-command.adapter` de DTOs legacy de `modules/appointments`.
- [x] PR34-B2: eliminar dependencia directa de `AppointmentsService` en adapters `booking` (`command/maintenance`) manteniendo compatibilidad HTTP y de casos de uso.
- [x] PR34-C1: mover bridge de `commerce/subscription-policy` fuera de `contexts/*` a `modules/subscriptions`.
- [x] PR34-C2: mover bridges de `engagement` fuera de `contexts/*` a módulos dueños de integración.
- [x] PR34-C3: mover bridges de `identity` y `ai-orchestration` fuera de `contexts/*` a módulos dueños.
- [x] PR34-C4: resolver bridges residuales de `booking/commerce` (`reviews|settings|imagekit`) con adapters de módulo o excepción documentada.
- [x] PR34-D: enforcement en `arch:check` para bloquear `contexts/* -> modules/*`.
- [x] PR35-A: limpieza de documentación/histórico de adapters movidos y referencias obsoletas.
- [x] PR35-B: preparación de Fase 9 (cleanup final + hardening de gates de release/CI).
- [x] PR35-C: cierre documental final (ADR/README post-migración + runbook operativo definitivo).
- [x] PR35-D: cleanup técnico final de modos transicionales (`appointments.facade/flags`).
- [x] PR36-A: endurecimiento final del release gate por perfil (`staging/canary/prod` con checks `runtime,auth`) + evidencia operativa de staging.
- [x] PR36-B: evidencia operativa final canary/prod en entorno con Stripe operativo (sin `checkout SKIP`).
- [x] PR36-C: cierre administrativo de Fase 9 y declaración formal de estado target.
- [x] PR37-A: housekeeping post-migración y baseline de mantenimiento.
- [x] PR37-B: optimización smoke/gates (tiempos y costo operativo).
- [x] PR37-C: priorización de deuda técnica residual post-migración.
- [x] PR38-A: primer recorte vertical residual (`cash-register`) al patrón target.
- [x] PR38-B: segundo recorte vertical `P0/P1` (`usage-metrics`) guiado por inventario residual.
- [x] PR38-C: extender smoke/auth con capacidad platform-metrics para el vertical migrado.
- [x] PR38-D: tercer recorte vertical `P0/P1` (`observability`) guiado por inventario residual.
- [x] PR38-E: ampliar smoke/auth + tests de use case del vertical `observability`.
- [x] PR39-A: cuarto recorte vertical `P0/P1` (`platform-admin`) guiado por inventario residual.
- [x] PR39-B: ampliar smoke/auth + tests de fachada del vertical `platform-admin`.
- [x] PR40-A: quinto recorte vertical `P0/P1` (`subscriptions`) guiado por inventario residual.
- [x] PR40-B: ampliar smoke/auth + tests de fachada/policy del vertical `subscriptions`.
- [x] PR41-A: sexto recorte vertical `P0/P1` (`notifications`) guiado por inventario residual.
- [x] PR41-B: ampliar smoke/auth + tests de fachada/policy del vertical `notifications`.
- [x] PR42-A: séptimo recorte vertical `P0` (`loyalty`) guiado por inventario residual.
- [x] PR42-B: ampliar smoke/auth + tests de fachada/policy del vertical `loyalty`.
- [x] PR43-A: octavo recorte vertical `P0` (`referrals`) fase 1 (`referral-attribution`) guiado por inventario residual.
- [x] PR43-B: ampliar smoke/auth + tests de fachada/policy del vertical `referrals` fase 1.
- [x] PR44-A: noveno recorte vertical `P0` (`referrals`) fase 2 (`rewards/config`) guiado por inventario residual.
- [x] PR44-B: ampliar smoke/auth + tests de fachada/policy del vertical `referrals` fase 2.
- [x] PR45-A1: extraer policies/tipos de conversación IA a `contexts/ai-orchestration/domain` y adelgazar `AiAssistantService`.
- [x] PR45-A2: extraer orquestación `chat/session/transcribe` a `contexts/ai-orchestration/application`.
- [x] PR45-B: ampliar smoke/auth + tests de fachada/use-cases de `ai-assistant`.
- [x] PR46-A1: extraer query path `findPage/findPageWithClients/findRangeWithClients` de `appointments` a `contexts/booking`.
- [x] PR46-A2: migrar `findOne` y `anonymize` de facade a use-cases de `booking` + recorte de métodos read legacy en `AppointmentsService`.
- [x] PR46-A3: migrar `dashboard-summary` a `contexts/booking` con policy de dominio y port/adapters read.
- [x] PR46-A4a: migrar write `remove` fuera de `AppointmentsService` a adapter de comando con Prisma + side-effects + audit.
- [x] PR46-A4b: migrar write de mantenimiento (`anonymize` + `syncStatuses*`) fuera de `AppointmentsService` a adapter de mantenimiento.
- [x] PR46-A4c: eliminar fallback legacy facade (`availability-batch`, `weekly-load`) y retirar métodos legacy equivalentes del `AppointmentsService`.
- [x] PR46-A4d: migrar `sendPaymentConfirmation` a `booking` use case + maintenance adapter (sin dependencia de `AppointmentsService`).
- [x] PR46-A4e: extraer políticas de `update` a dominio (`update-appointment-policy`) y eliminar dependencia residual `AppointmentsFacade -> AppointmentsService`.
- [x] PR46-A4f1: retirar engine legacy de availability residual en `AppointmentsService` (`getAvailableSlots*` + helpers internos) y consolidar validación por `GetAvailabilityUseCase`.
- [x] PR46-A4f2: mover orquestación write de `update` al `ModuleBookingCommandAdapter` y eliminar `AppointmentsService.update`.
- [x] PR46-A4f3: mover orquestación write de `create` al `ModuleBookingCommandAdapter` y retirar `AppointmentsService` del runtime.
- [x] PR46-B: cerrar recorte residual de `appointments` jobs (`retention`) sin Prisma directo y validar inventario residual sin `P0`.
- [x] PR46-A: recorte final del módulo `P0` (`appointments`) hacia `contexts/booking/application`.

## Decisiones Cerradas (ADRs)
Ver indice: [ADR README](/Users/carlos/Projects/managgio/app/backend/docs/adr/README.md)
- ADR-0001: CQRS pragmatico.
- ADR-0002: Transaction boundary + SERIALIZABLE.
- ADR-0003: Domain events sync ahora + Outbox despues.
- ADR-0004: Idempotencia en application.
- ADR-0005: RequestContext final + ClockPort.
- ADR-0006: Cross-context contracts via ports/ACL.
- ADR-0007: Aggregate boundaries (Appointment vs Availability).
- ADR-0008: Prisma tenant guard como defensa en profundidad.

## Guardrails P0 (deben quedar activos)
- [x] ESLint `no-restricted-imports` por capas (`domain/application` sin Nest/Prisma/SDKs).
- [x] Architecture test de imports (CI gate).
- [x] Feature flags por capability usados durante strangler y retirados al cierre (`appointments` fijo en `v2` desde PR35-D).
- [x] Shadow diff harness usado durante migración y retirado al cierre (`shadow-diff.ts` eliminado en PR35-D).
- [x] Observabilidad minima por use case (timing/error/diff-rate por logs estructurados).
- [x] Legacy bridges con `delete-by-phase` y ticket.

Implementacion tecnica:
- ESLint: [backend/.eslintrc.cjs](/Users/carlos/Projects/managgio/app/backend/.eslintrc.cjs)
- Architecture check: [check-architecture-boundaries.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/check-architecture-boundaries.mjs)
- Shadow diff: eliminado en PR35-D (no aplica en estado post-migración).
- Inventory generator: [generate-appointments-inventory.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/generate-appointments-inventory.mjs)
- Legacy bridge policy: artefactos transicionales removidos y trazados en [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)
- Capability flags: [appointments.flags.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.flags.ts)

## Rollout PR4 (Availability Single)
- Objetivo: mover `GET /appointments/availability` a `shadow` por defecto en staging, sin tocar aun batch/weekly.
- Flags activas:
  - `BOOKING_CAP_AVAILABILITY_SINGLE_MODE`
  - `BOOKING_CAP_AVAILABILITY_BATCH_MODE`
  - `BOOKING_CAP_WEEKLY_LOAD_MODE`
  - `BOOKING_AVAILABILITY_READ_MODE` (fallback global)
  - `BOOKING_AVAILABILITY_MODE` (compatibilidad legacy)
- Defaults:
  - Staging (estado al cierre de PR4): `single=shadow`, `batch=legacy`, `weekly=legacy`.
  - Resto de entornos: `legacy` si no hay override.
- Criterio de avance a `v2`:
  - drift rate establemente bajo en logs de shadow,
  - error rate de shadow-v2 sin regresion,
  - validacion funcional con casos de agenda reales.

## Rollout PR5 (Availability Batch + Weekly Load)
- Objetivo: mover `GET /appointments/availability-batch` y `GET /appointments/weekly-load` a `shadow` por defecto en staging.
- Defaults:
  - Staging: `single=shadow`, `batch=shadow`, `weekly=shadow`.
  - Resto de entornos: `legacy` si no hay override.
- Criterio de avance a `v2`:
  - drift rate bajo y estable en ambos endpoints,
  - sin aumento de errores ni degradacion de latencia,
  - validacion manual de agendas multi-barbero.

## Rollout PR6 (Create Appointment Write Path)
- Objetivo: enrutar `POST /appointments` por `CreateAppointmentUseCase` sin romper comportamiento.
- Estado actual:
  - `CreateAppointmentUseCase` implementado en application.
  - `BookingCommandPort` y `BookingUnitOfWorkPort` definidos.
  - Adapter puente `legacy` conectado.
  - En `shadow` se mantiene fallback a legacy para evitar side effects duplicados.
- Flags activas:
  - `BOOKING_CAP_APPOINTMENT_CREATE_MODE`
  - `BOOKING_APPOINTMENT_WRITE_MODE`
  - `BOOKING_CREATE_MODE`

## Rollout PR7 (Create v2 + Checkout)
- Objetivo: asegurar que la creacion de cita por HTTP y por checkout Stripe usa el mismo entrypoint (`AppointmentsFacade`) y el mismo flag de capability.
- Estado actual:
  - `PaymentsService` usa `AppointmentsFacade` (no `AppointmentsService` directo) para `create/update/sendPaymentConfirmation`.
  - Default en staging para create: `v2` (con fallback por flags).
- Criterio de salida:
  - create path estable en staging sin drift funcional,
  - sin regressions en flow de checkout,
  - rollback inmediato posible via flags.

## Rollout PR8 (Update path)
- Objetivo: enrutar `PATCH /appointments/:id` via `UpdateAppointmentUseCase` sin cambio funcional.
- Estado actual:
  - `UpdateAppointmentUseCase` implementado.
  - `UpdateAppointmentCommand` implementado.
  - `BookingCommandPort` extendido con `updateAppointment`.
  - `AppointmentsFacade.update` con modo `legacy|shadow|v2` (shadow con fallback seguro).
  - `RemoveAppointmentUseCase` implementado y `DELETE /appointments/:id` enrutable por flag.
- Flags:
  - `BOOKING_CAP_APPOINTMENT_UPDATE_MODE`
  - `BOOKING_APPOINTMENT_WRITE_MODE`
  - `BOOKING_UPDATE_MODE`
  - `BOOKING_CAP_APPOINTMENT_REMOVE_MODE`
  - `BOOKING_REMOVE_MODE`

## Rollout PR9 (Status Side Effects + Idempotencia)
- Objetivo: separar side effects de status fuera de `AppointmentsService` y encapsular idempotencia.
- Estado:
  - `RunAppointmentStatusSideEffectsUseCase` implementado.
  - Port de side effects y adapter legacy implementados.
  - Port de idempotencia y adapter lock-based implementados.
  - `create`, `update`, `remove` y `syncStatuses` ya llaman al use case.
- Componentes:
  - [run-appointment-status-side-effects.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/use-cases/run-appointment-status-side-effects.use-case.ts)
  - [booking-status-side-effects.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/ports/outbound/booking-status-side-effects.port.ts)
  - [booking-idempotency.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/ports/outbound/booking-idempotency.port.ts)
  - `legacy-booking-status-side-effects.adapter.ts` (eliminado en PR20-C3B; ver checklist transicional)
  - [distributed-lock-booking-idempotency.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/infrastructure/adapters/distributed-lock-booking-idempotency.adapter.ts)

## Rollout PR10 (Jobs -> UseCases)
- Objetivo: que cron jobs de booking no llamen `AppointmentsService` directo.
- Estado:
  - `AppointmentsStatusSyncService` usa `SyncAppointmentStatusesUseCase`.
  - `AppointmentsRetentionService` usa `AnonymizeAppointmentUseCase`.
  - Port de mantenimiento + adapter legacy implementados para transición sin cambio funcional.
- Componentes:
  - [sync-appointment-statuses.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/use-cases/sync-appointment-statuses.use-case.ts)
  - [anonymize-appointment.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/use-cases/anonymize-appointment.use-case.ts)
  - [booking-maintenance.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/ports/outbound/booking-maintenance.port.ts)
  - `legacy-booking-maintenance.adapter.ts` (eliminado en PR20-C3B; ver checklist transicional)
  - [appointments-status-sync.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-status-sync.service.ts)
  - [appointments-retention.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-retention.service.ts)

## Rollout PR11 (Commerce Pricing Core)
- Objetivo: centralizar pricing de servicios en `contexts/commerce` y consumirlo desde booking sin logica de pricing embebida.
- Estado:
  - `service-pricing-policy` de dominio implementada.
  - `PrismaServicePricingPolicyAdapter` implementado.
  - `AppointmentsService.calculateAppointmentPrice` consume `COMMERCE_SERVICE_PRICING_PORT`.
  - test unitario de politica de pricing agregado.
- Componentes:
  - [service-pricing-policy.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/domain/services/service-pricing-policy.ts)
  - [service-pricing.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/service-pricing.port.ts)
  - [prisma-service-pricing-policy.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/prisma/prisma-service-pricing-policy.adapter.ts)
  - [commerce-service-pricing-policy.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-service-pricing-policy.test.ts)

## Rollout PR12 (Subscriptions ACL)
- Objetivo: cortar dependencia directa de booking con `SubscriptionsService` usando un port de commerce.
- Estado:
  - Port `COMMERCE_SUBSCRIPTION_POLICY_PORT` definido.
  - Adapter puente `LegacyCommerceSubscriptionPolicyAdapter` implementado.
  - `AppointmentsService` usa el port para resolver suscripcion activa.
  - `LegacyBookingStatusSideEffectsAdapter` usa el port para settlement in-person.
  - `LoyaltyService`, `ReferralAttributionService` y `RewardsService` usan el port (sin import directo de `SubscriptionsService`).
  - tests unitarios del adapter agregados.
- Componentes:
  - [subscription-policy.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/subscription-policy.port.ts)
  - `legacy-commerce-subscription-policy.adapter.ts` (eliminado en PR20-C4; reemplazado por adapter en `modules/subscriptions`)
  - [appointments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.service.ts)
  - `legacy-booking-status-side-effects.adapter.ts` (eliminado en PR20-C3B)
  - [loyalty.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/loyalty/loyalty.service.ts)
  - [referral-attribution.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referral-attribution.service.ts)
  - [rewards.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/rewards.service.ts)
  - [commerce-subscription-policy.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-subscription-policy.adapter.test.ts)

## Rollout PR13 (Loyalty + Wallet/Coupon ACL Inicial)
- Objetivo: cortar acoplamiento directo de booking con `LoyaltyService`/`RewardsService` y preparar extraccion del core comercial.
- Estado:
  - Port `COMMERCE_LOYALTY_POLICY_PORT` definido + adapter puente legacy.
  - Port `COMMERCE_WALLET_LEDGER_PORT` definido + adapter puente legacy.
  - `AppointmentsService` ya no importa `LoyaltyService` ni `RewardsService` (consume ports).
  - Transacciones de create siguen preservando comportamiento via adapter (`reserveWalletHold`/`reserveCouponUsage`).
  - tests de adapters y de appointments actualizados.
- Componentes:
  - [loyalty-policy.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/loyalty-policy.port.ts)
  - [wallet-ledger.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/wallet-ledger.port.ts)
  - `legacy-commerce-loyalty-policy.adapter.ts` (eliminado en PR20-C2A)
  - `legacy-commerce-wallet-ledger.adapter.ts` (eliminado en PR20-C2B)
  - [appointments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.service.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - `commerce-loyalty-wallet.adapters.test.ts` (eliminado en PR20-C2B)

## Rollout PR13-B (Domain Policies en Commerce)
- Objetivo: mover reglas transversales de loyalty/cupones a dominio commerce para empezar a retirar logica de `modules/*`.
- Estado:
  - `calculateCouponDiscount` extraido a `contexts/commerce/domain/services/coupon-discount-policy.ts`.
  - `buildLoyaltyProgress` + `isNextLoyaltyVisitFree` extraidos a `contexts/commerce/domain/services/loyalty-progress-policy.ts`.
  - `RewardsService.calculateCouponDiscount` consume la politica de dominio.
  - `LegacyCommerceWalletLedgerAdapter.calculateCouponDiscount` ya no delega en `RewardsService`; usa politica de dominio.
  - `LoyaltyService` usa politicas de progreso loyalty del core.
  - tests unitarios de ambas politicas agregados.
- Componentes:
  - [coupon-discount-policy.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/domain/services/coupon-discount-policy.ts)
  - [loyalty-progress-policy.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/domain/services/loyalty-progress-policy.ts)
  - [rewards.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/rewards.service.ts)
  - `legacy-commerce-wallet-ledger.adapter.ts` (eliminado en PR20-C2B)
  - [loyalty.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/loyalty/loyalty.service.ts)
  - [commerce-coupon-discount-policy.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-coupon-discount-policy.test.ts)
  - [commerce-loyalty-progress-policy.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-loyalty-progress-policy.test.ts)

## Rollout PR13-C1 (Loyalty Reward Decision UseCase)
- Objetivo: mover el decision-making de loyalty en booking path desde servicio legacy a `commerce/application`.
- Estado:
  - `ResolveLoyaltyRewardDecisionUseCase` implementado.
  - `CommerceLoyaltyPolicyReadPort` definido.
  - `PrismaCommerceLoyaltyPolicyReadAdapter` implementado (programas/visitas/rol/enablement).
  - `PrismaCommerceLoyaltyPolicyAdapter` usa el use case y se conecta como `COMMERCE_LOYALTY_POLICY_PORT` en `AppointmentsModule`.
  - `AppointmentsModule` elimina dependencia de `LoyaltyModule` para este path.
  - tests unitarios del use case agregados.
- Componentes:
  - [resolve-loyalty-reward-decision.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/application/use-cases/resolve-loyalty-reward-decision.use-case.ts)
  - [loyalty-policy-read.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/loyalty-policy-read.port.ts)
  - [prisma-commerce-loyalty-policy-read.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/prisma/prisma-commerce-loyalty-policy-read.adapter.ts)
  - [prisma-commerce-loyalty-policy.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/adapters/prisma-commerce-loyalty-policy.adapter.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [commerce-resolve-loyalty-reward-decision.usecase.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-resolve-loyalty-reward-decision.usecase.test.ts)

## Rollout PR13-C2 (Wallet/Coupon Booking UseCase)
- Objetivo: mover lógica de wallet/coupon usada en booking path a `commerce/application` y retirar dependencia directa de `RewardsService` en ese path.
- Estado:
  - `BookingWalletLedgerUseCase` implementado en `commerce/application`.
  - `CommerceWalletLedgerPersistencePort` definido.
  - `PrismaWalletLedgerPersistenceAdapter` implementado.
  - `PrismaCommerceWalletLedgerAdapter` implementado y conectado como `COMMERCE_WALLET_LEDGER_PORT` en `AppointmentsModule`.
  - booking path (`appointments`) ya no usa bridge legacy para wallet/coupon.
  - tests unitarios del use case agregados.
- Componentes:
  - [booking-wallet-ledger.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/application/use-cases/booking-wallet-ledger.use-case.ts)
  - [wallet-ledger-persistence.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/wallet-ledger-persistence.port.ts)
  - [prisma-wallet-ledger-persistence.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/prisma/prisma-wallet-ledger-persistence.adapter.ts)
  - [prisma-commerce-wallet-ledger.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/adapters/prisma-commerce-wallet-ledger.adapter.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [commerce-booking-wallet-ledger.usecase.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-booking-wallet-ledger.usecase.test.ts)

## Rollout PR14-A (Referral Attribution ACL en Booking)
- Objetivo: eliminar dependencia directa de `AppointmentsService` con `ReferralAttributionService`.
- Estado:
  - `EngagementReferralAttributionPort` definido.
  - `LegacyEngagementReferralAttributionAdapter` implementado como bridge.
  - `AppointmentsService` usa el port para `resolveAttributionForBooking` y `attachAttributionToAppointment`.
  - `LegacyBookingStatusSideEffectsAdapter` usa el mismo port para completed/cancelled referral side effects.
  - wiring en `AppointmentsModule` actualizado.
- Componentes:
  - [referral-attribution.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/referral-attribution.port.ts)
  - `legacy-engagement-referral-attribution.adapter.ts` (eliminado en PR20-C4)
  - [appointments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.service.ts)
  - `legacy-booking-status-side-effects.adapter.ts` (eliminado en PR20-C3B)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)

## Rollout PR14-B (Referral Attribution UseCases)
- Objetivo: mover `resolveAttributionForBooking` y `attachAttributionToAppointment` a `engagement/application`.
- Estado:
  - `ResolveReferralAttributionForBookingUseCase` implementado.
  - `AttachReferralAttributionToAppointmentUseCase` implementado.
  - `EngagementReferralAttributionPersistencePort` definido.
  - adapter de persistencia de attribution implementado (attribution/config/user contact), movido en PR34-C2 a `modules/referrals`.
  - `LegacyEngagementReferralAttributionAdapter` ahora usa estos use cases para path booking.
  - `AppointmentsModule` cableado con providers de persistence + use cases.
  - tests unitarios de ambos use cases agregados.
- Componentes:
  - [resolve-referral-attribution-for-booking.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/application/use-cases/resolve-referral-attribution-for-booking.use-case.ts)
  - [attach-referral-attribution-to-appointment.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/application/use-cases/attach-referral-attribution-to-appointment.use-case.ts)
  - [referral-attribution-persistence.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/referral-attribution-persistence.port.ts)
  - [module-engagement-referral-attribution-persistence.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/adapters/module-engagement-referral-attribution-persistence.adapter.ts)
  - `legacy-engagement-referral-attribution.adapter.ts` (eliminado en PR20-C4)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [engagement-resolve-referral-attribution-for-booking.usecase.test.ts](/Users/carlos/Projects/managgio/app/backend/test/engagement-resolve-referral-attribution-for-booking.usecase.test.ts)
  - [engagement-attach-referral-attribution-to-appointment.usecase.test.ts](/Users/carlos/Projects/managgio/app/backend/test/engagement-attach-referral-attribution-to-appointment.usecase.test.ts)

## Rollout PR14-C (Referral Completion/Cancel + Rewarding)
- Objetivo: mover `handleAppointmentCompleted` y `handleAppointmentCancelled` a `engagement/application` y aislar rewards/notificaciones por puertos.
- Estado:
  - `HandleReferralAppointmentCancelledUseCase` implementado (restaura `ATTRIBUTED` o marca `EXPIRED`).
  - `HandleReferralAppointmentCompletedUseCase` implementado (validaciones de elegibilidad, rewarding transaccional y notificaciones).
  - `EngagementReferralRewardPort` y `EngagementReferralNotificationPort` definidos.
  - adapters puente `legacy` para rewards/notificaciones implementados.
  - adapter de persistencia de attribution extendido para soporte de completion/cancel flow (movido a `modules/referrals` en PR34-C2).
  - `LegacyEngagementReferralAttributionAdapter` consume use cases de `resolve/attach/cancel/completed`.
  - `AppointmentsModule` cableado con providers de reward/notification + use cases de completion/cancel.
  - tests unitarios agregados para ambos use cases nuevos.
- Componentes:
  - [handle-referral-appointment-cancelled.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/application/use-cases/handle-referral-appointment-cancelled.use-case.ts)
  - [handle-referral-appointment-completed.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/application/use-cases/handle-referral-appointment-completed.use-case.ts)
  - [referral-reward.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/referral-reward.port.ts)
  - [referral-notification.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/referral-notification.port.ts)
  - `legacy-engagement-referral-reward.adapter.ts` (eliminado en PR20-C4)
  - `legacy-engagement-referral-notification.adapter.ts` (eliminado en PR20-C4)
  - [module-engagement-referral-attribution-persistence.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/adapters/module-engagement-referral-attribution-persistence.adapter.ts)
  - `legacy-engagement-referral-attribution.adapter.ts` (eliminado en PR20-C4)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [engagement-handle-referral-appointment-cancelled.usecase.test.ts](/Users/carlos/Projects/managgio/app/backend/test/engagement-handle-referral-appointment-cancelled.usecase.test.ts)
  - [engagement-handle-referral-appointment-completed.usecase.test.ts](/Users/carlos/Projects/managgio/app/backend/test/engagement-handle-referral-appointment-completed.usecase.test.ts)

## Rollout PR15-A (Stripe Gateway Port en Payments)
- Objetivo: eliminar dependencia directa de `PaymentsService` con SDK Stripe y encapsular checkout/webhooks en adapter.
- Estado:
  - `CommerceStripePaymentGatewayPort` definido en `contexts/commerce/ports/outbound`.
  - `StripePaymentGatewayAdapter` implementado en infraestructura (creacion de cuenta/link, checkout, retrieve session, webhook construct).
  - `PaymentsService` migrado para usar el port en lugar de `new Stripe(...)`.
  - `PaymentsModule` cableado con provider `COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT`.
  - contract tests del adapter agregados (mapping checkout + webhook firmado/no firmado).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [stripe-payment-gateway.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/stripe-payment-gateway.port.ts)
  - [stripe-payment-gateway.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/adapters/stripe-payment-gateway.adapter.ts)
  - [payments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.service.ts)
  - [payments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.module.ts)
  - [commerce-stripe-payment-gateway.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/commerce-stripe-payment-gateway.adapter.test.ts)

## Rollout PR15-B (Stripe Gateway Port en Subscriptions)
- Objetivo: eliminar dependencia directa de `SubscriptionsService` con SDK Stripe y reutilizar el mismo port/adapters de commerce.
- Estado:
  - `SubscriptionsService` usa `CommerceStripePaymentGatewayPort` para validacion de cuenta y creacion de checkout.
  - `SubscriptionsModule` cableado con `COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT`.
  - PR15 queda cerrado (payments + subscriptions sin import directo de SDK Stripe en services legacy).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [subscriptions.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions.service.ts)
  - [subscriptions.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions.module.ts)
  - [stripe-payment-gateway.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/stripe-payment-gateway.port.ts)
  - [stripe-payment-gateway.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/adapters/stripe-payment-gateway.adapter.ts)

## Rollout PR16 (Notifications Adapters)
- Objetivo: eliminar dependencias directas a SDKs de `NotificationsService` y mover integración de email/SMS/WhatsApp a adapters de infraestructura.
- Estado:
  - ports `ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT` y `ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT` definidos.
  - adapters `NodemailerEmailTransportFactoryAdapter` y `TwilioClientFactoryAdapter` implementados.
  - `NotificationsService` ya no importa `nodemailer` ni `twilio`; usa puertos inyectados.
  - `NotificationsModule` cableado con providers de infraestructura para ambos puertos.
  - contract tests de ambos adapters agregados.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [email-transport-factory.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/email-transport-factory.port.ts)
  - [twilio-client-factory.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/twilio-client-factory.port.ts)
  - [nodemailer-email-transport-factory.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/adapters/nodemailer-email-transport-factory.adapter.ts)
  - [twilio-client-factory.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/adapters/twilio-client-factory.adapter.ts)
  - [notifications.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/notifications.service.ts)
  - [notifications.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/notifications.module.ts)
  - [engagement-nodemailer-email-transport-factory.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/engagement-nodemailer-email-transport-factory.adapter.test.ts)
  - [engagement-twilio-client-factory.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/engagement-twilio-client-factory.adapter.test.ts)

## Rollout PR17-A (AI Orchestration ACL Inicial)
- Objetivo: eliminar acoplamientos directos de `AiToolsRegistry` con servicios cross-context (`appointments`, `holidays`, `alerts`) usando puertos ACL.
- Estado:
  - ports `AI_BOOKING_TOOL_PORT`, `AI_HOLIDAY_TOOL_PORT`, `AI_ALERT_TOOL_PORT` definidos en `contexts/ai-orchestration`.
  - adapters puente legacy implementados (`LegacyAiBookingToolAdapter`, `LegacyAiHolidayToolAdapter`, `LegacyAiAlertToolAdapter`).
  - `AiToolsRegistry` ya consume puertos (no importa servicios de módulos para esos paths).
  - `AiAssistantModule` cableado con providers de ACL.
  - tests unitarios de adapters agregados.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [ai-booking-tool.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/ports/outbound/ai-booking-tool.port.ts)
  - [ai-holiday-tool.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/ports/outbound/ai-holiday-tool.port.ts)
  - [ai-alert-tool.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/ports/outbound/ai-alert-tool.port.ts)
  - `legacy-ai-booking-tool.adapter.ts` (eliminado en PR20-C4)
  - `legacy-ai-holiday-tool.adapter.ts` (eliminado en PR20-C4)
  - `legacy-ai-alert-tool.adapter.ts` (eliminado en PR20-C4)
  - [ai-tools.registry.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-tools.registry.ts)
  - [ai-assistant.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.module.ts)
  - [ai-legacy-tool-adapters.test.ts](/Users/carlos/Projects/managgio/app/backend/test/ai-legacy-tool-adapters.test.ts)

## Rollout PR17-B (AI Tools Read Port)
- Objetivo: eliminar lecturas directas de `PrismaService` dentro de `AiToolsRegistry`.
- Estado:
  - `AI_TOOLS_READ_PORT` definido con contratos de lectura para barberos/servicios/clientes.
  - `PrismaAiToolsReadAdapter` implementado como adapter de infraestructura.
  - `AiToolsRegistry` refactorizado para consumir `AiToolsReadPort` (sin `PrismaService` directo).
  - `AiAssistantModule` cableado con provider `AI_TOOLS_READ_PORT`.
  - tests de adapter + actualización de tests de `AiToolsRegistry` completados.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [ai-tools-read.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/ports/outbound/ai-tools-read.port.ts)
  - [prisma-ai-tools-read.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/infrastructure/prisma/prisma-ai-tools-read.adapter.ts)
  - [ai-tools.registry.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-tools.registry.ts)
  - [ai-assistant.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.module.ts)
  - [ai-prisma-tools-read.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/ai-prisma-tools-read.adapter.test.ts)
  - [ai-tools-registry.test.ts](/Users/carlos/Projects/managgio/app/backend/test/ai-tools-registry.test.ts)

## Rollout PR17-C (AI Admin Access Port)
- Objetivo: eliminar lecturas directas de `PrismaService` en `AiAssistantService` y `AiAssistantGuard`.
- Estado:
  - port `AI_ADMIN_ACCESS_READ_PORT` definido para validacion de usuario admin y membresia local.
  - adapter `PrismaAiAdminAccessReadAdapter` implementado.
  - `AiAssistantService` usa `AiAdminAccessReadPort` en `ensureAdminUser`.
  - `AiAssistantGuard` usa `AiAdminAccessReadPort` en `canActivate`.
  - tests de adapter agregados.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [ai-admin-access-read.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/ports/outbound/ai-admin-access-read.port.ts)
  - [prisma-ai-admin-access-read.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/ai-orchestration/infrastructure/prisma/prisma-ai-admin-access-read.adapter.ts)
  - [ai-assistant.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.service.ts)
  - [ai-assistant.guard.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.guard.ts)
  - [ai-assistant.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.module.ts)
  - [ai-prisma-admin-access-read.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/ai-prisma-admin-access-read.adapter.test.ts)

## Rollout PR18-A (Tenant Context Explicito en AI)
- Objetivo: iniciar desacople de ALS helpers (`getCurrent*`) moviendo AI service/guard a `TenantContextPort`.
- Estado:
  - `AiAssistantService` reemplaza uso de `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `AiAssistantGuard` reemplaza uso de `getCurrentLocalId` por `TenantContextPort`.
  - `AiAssistantModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [ai-assistant.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.service.ts)
  - [ai-assistant.guard.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.guard.ts)
  - [ai-assistant.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.module.ts)

## Rollout PR18-B (Tenant Context Explicito en AiToolsRegistry)
- Objetivo: eliminar dependencia de `AiToolsRegistry` con helpers globales ALS (`getCurrentLocalId/getCurrentBrandId`).
- Estado:
  - `AiToolsRegistry` inyecta `TenantContextPort`.
  - helper methods internos `getLocalId/getBrandId` usan `tenantContextPort.getRequestContext()`.
  - reemplazadas todas las lecturas previas `getCurrentLocalId/getCurrentBrandId`.
  - tests de `AiToolsRegistry` adaptados al nuevo constructor.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [ai-tools.registry.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-tools.registry.ts)
  - [ai-tools-registry.test.ts](/Users/carlos/Projects/managgio/app/backend/test/ai-tools-registry.test.ts)

## Rollout PR18-C1 (Tenant Context Explicito en Firebase)
- Objetivo: reducir dependencia de helpers ALS en integraciones de identidad.
- Estado:
  - `FirebaseAdminService` reemplaza `getCurrentBrandId` por `TenantContextPort`.
  - `FirebaseModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [firebase-admin.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/firebase/firebase-admin.service.ts)
  - [firebase.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/firebase/firebase.module.ts)

## Rollout PR18-C2 (Tenant Context Explicito en Users)
- Objetivo: reducir dependencia de helpers ALS en modulo `users` (service/controller).
- Estado:
  - `UsersService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `UsersController` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `UsersModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [users.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/users/users.service.ts)
  - [users.controller.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/users/users.controller.ts)
  - [users.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/users/users.module.ts)

## Rollout PR18-C3A (Tenant Context Explicito en Platform/Admin Slice)
- Objetivo: reducir dependencia de `getCurrent*` en capa platform/admin de bajo riesgo y reforzar propagacion por `RequestContext`.
- Estado:
  - `UsageMetricsService` reemplaza `getCurrentBrandId` por `TenantContextPort`.
  - `AuditLogsService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `ObservabilityController` y `ApiMetricsInterceptor` reemplazan helpers ALS por `TenantContextPort`.
  - `AdminGuard` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `PaymentsAdminController` y `ReferralsAdminController` reemplazan `getCurrentLocalId` por `TenantContextPort`.
  - wiring DI agregado en `AppModule`, `UsageMetricsModule`, `AuditLogsModule`, `ObservabilityModule`, `PaymentsModule`, `ReferralsModule`.
  - `RequestContext` mantiene `subdomain` opcional para preservar señal de observabilidad.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [usage-metrics.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/usage-metrics/usage-metrics.service.ts)
  - [audit-logs.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/audit-logs/audit-logs.service.ts)
  - [api-metrics.interceptor.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/observability/api-metrics.interceptor.ts)
  - [observability.controller.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/observability/observability.controller.ts)
  - [admin.guard.ts](/Users/carlos/Projects/managgio/app/backend/src/auth/admin.guard.ts)
  - [payments.admin.controller.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.admin.controller.ts)
  - [referrals.admin.controller.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.admin.controller.ts)
  - [request-context.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/request-context.ts)

## Rollout PR18-C4A (Tenant Context Explicito en Notifications)
- Objetivo: eliminar dependencia de helpers ALS en notificaciones operativas.
- Estado:
  - `NotificationsService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `RemindersService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `NotificationsModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [notifications.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/notifications.service.ts)
  - [reminders.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/reminders.service.ts)
  - [notifications.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/notifications.module.ts)

## Rollout PR18-C4B (Tenant Context Explicito en CRUD Low-Risk)
- Objetivo: reducir rapido superficie legacy en modulos CRUD tenant-scoped sin cambio funcional.
- Estado:
  - `AlertsService`, `RolesService`, `ServiceCategoriesService`, `ProductCategoriesService`, `HolidaysService`, `SchedulesService` reemplazan `getCurrentLocalId` por `TenantContextPort`.
  - wiring DI agregado en sus modulos con `TENANT_CONTEXT_PORT` + `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [alerts.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/alerts/alerts.service.ts)
  - [roles.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/roles/roles.service.ts)
  - [service-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/service-categories/service-categories.service.ts)
  - [product-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/product-categories/product-categories.service.ts)
  - [holidays.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/holidays/holidays.service.ts)
  - [schedules.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/schedules/schedules.service.ts)

## Rollout PR18-C4C (Tenant Context Explicito en Client Notes + Settings)
- Objetivo: retirar helpers ALS en configuracion/local notes que ya estaban tenant-scoped.
- Estado:
  - `ClientNotesService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `SettingsService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - wiring DI agregado en `ClientNotesModule` y `SettingsModule`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [client-notes.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/client-notes/client-notes.service.ts)
  - [settings.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/settings/settings.service.ts)
  - [client-notes.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/client-notes/client-notes.module.ts)
  - [settings.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/settings/settings.module.ts)

## Rollout PR18-C4D (Tenant Context Explicito en Reviews)
- Objetivo: retirar helpers ALS del flujo de reseñas (configuracion, solicitud y analitica).
- Estado:
  - `ReviewRequestService`, `ReviewConfigService` y `ReviewAnalyticsService` reemplazan `getCurrentLocalId` por `TenantContextPort`.
  - `ReviewsModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [review-request.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/reviews/review-request.service.ts)
  - [review-config.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/reviews/review-config.service.ts)
  - [review-analytics.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/reviews/review-analytics.service.ts)
  - [reviews.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/reviews/reviews.module.ts)

## Rollout PR18-C4E (Tenant Context Explicito en Services/Products/Offers)
- Objetivo: eliminar dependencia de helpers ALS en modulos comerciales CRUD y formalizar scope explicito en utilidades de settings.
- Estado:
  - `ServicesService`, `ProductsService` y `OffersService` reemplazan `getCurrentLocalId` por `TenantContextPort`.
  - `ServicesModule`, `ProductsModule` y `OffersModule` cableados con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - `services.utils` y `products.utils` dejan de leer tenant implícito y reciben scope explicito (`localId`/`brandId`) por parametro.
  - callers actualizados (`service-categories`, `product-categories`, `cash-register` para firma de utilidades).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [services.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/services/services.service.ts)
  - [products.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/products/products.service.ts)
  - [offers.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/offers/offers.service.ts)
  - [services.utils.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/services/services.utils.ts)
  - [products.utils.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/products/products.utils.ts)
  - [service-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/service-categories/service-categories.service.ts)
  - [product-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/product-categories/product-categories.service.ts)
  - [cash-register.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/cash-register/cash-register.service.ts)

## Rollout PR18-C4F (Tenant Context Explicito en Barbers + Cash Register)
- Objetivo: retirar helpers ALS en operaciones operativas de personal y caja.
- Estado:
  - `BarbersService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `CashRegisterService` reemplaza `getCurrentLocalId/getCurrentBrandId` por `TenantContextPort`.
  - `BarbersModule` y `CashRegisterModule` cableados con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [barbers.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/barbers/barbers.service.ts)
  - [cash-register.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/cash-register/cash-register.service.ts)
  - [barbers.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/barbers/barbers.module.ts)
  - [cash-register.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/cash-register/cash-register.module.ts)

## Rollout PR18-C4G (Tenant Context Explicito en AI Memory + ImageKit)
- Objetivo: retirar helpers ALS en memoria conversacional AI y firma/subida de assets.
- Estado:
  - `AiMemoryService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `ImageKitService` reemplaza `getCurrentBrandId/getTenantContext` por `TenantContextPort`.
  - `ImageKitModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [ai-memory.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-memory.service.ts)
  - [imagekit.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/imagekit/imagekit.service.ts)
  - [imagekit.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/imagekit/imagekit.module.ts)

## Rollout PR18-C4H (Tenant Context Explicito en Referral Config/Code/Scheduler)
- Objetivo: retirar helpers ALS en la capa de configuracion y orquestacion de referidos.
- Estado:
  - `ReferralCodeService`, `ReferralConfigService` y `ReferralsSchedulerService` reemplazan `getCurrentLocalId` por `TenantContextPort`.
  - `ReferralsModule` ya contaba con `TENANT_CONTEXT_PORT` y se reutiliza sin cambio de contrato.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [referral-code.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referral-code.service.ts)
  - [referral-config.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referral-config.service.ts)
  - [referrals.scheduler.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.scheduler.ts)

## Rollout PR18-C4I (Tenant Context Explicito en Referral Attribution + Rewards)
- Objetivo: cerrar la parte transaccional de referidos sin dependencia de helpers ALS.
- Estado:
  - `ReferralAttributionService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `RewardsService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - tests de referidos actualizados por cambio de constructor (`tenantContextPort` mock).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [referral-attribution.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referral-attribution.service.ts)
  - [rewards.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/rewards.service.ts)
  - [referral-anti-fraud.test.ts](/Users/carlos/Projects/managgio/app/backend/test/referral-anti-fraud.test.ts)
  - [referral-rewarding.test.ts](/Users/carlos/Projects/managgio/app/backend/test/referral-rewarding.test.ts)
  - [referral-rewards.test.ts](/Users/carlos/Projects/managgio/app/backend/test/referral-rewards.test.ts)

## Rollout PR18-C4J (Tenant Context Explicito en Loyalty)
- Objetivo: retirar helpers ALS del modulo de fidelizacion y mantener politicas comerciales desacopladas.
- Estado:
  - `LoyaltyService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - `LoyaltyModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [loyalty.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/loyalty/loyalty.service.ts)
  - [loyalty.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/loyalty/loyalty.module.ts)

## Rollout PR18-C4K (Tenant Context Explicito en Legal)
- Objetivo: retirar helpers ALS del modulo legal y conservar trazabilidad/auditoria sin cambios funcionales.
- Estado:
  - `LegalService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `LegalModule` cableado con `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [legal.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/legal/legal.service.ts)
  - [legal.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/legal/legal.module.ts)

## Rollout PR18-C4L (Tenant Context Explicito en Subscriptions + Payments + Appointments)
- Objetivo: cerrar los modulos legacy de mayor acoplamiento removiendo `getCurrent*` en paths criticos de booking/commerce.
- Estado:
  - `SubscriptionsService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `PaymentsService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort` (se mantiene `runWithTenantContextAsync` solo como bridge de webhooks).
  - `AppointmentsService` reemplaza `getCurrentLocalId` por `TenantContextPort`.
  - tests adaptados por cambio de constructor (`appointments-consent`).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [subscriptions.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions.service.ts)
  - [subscriptions.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions.module.ts)
  - [payments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.service.ts)
  - [appointments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.service.ts)
  - [appointments-consent.test.ts](/Users/carlos/Projects/managgio/app/backend/test/appointments-consent.test.ts)

## Rollout PR18-C5A (Tenant Context Runner Port en Payments)
- Objetivo: encapsular el bridge ALS de ejecucion contextual fuera de `modules/*`.
- Estado:
  - nuevo port `TENANT_CONTEXT_RUNNER_PORT` + `TenantContextRunnerPort`.
  - nuevo adapter `AlsTenantContextRunnerAdapter` que encapsula `runWithTenantContextAsync`.
  - `PaymentsService` deja de importar `tenancy/tenant.context`.
  - `PaymentsModule` cablea el nuevo port.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant-context-runner.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/tenant-context-runner.port.ts)
  - [als-tenant-context-runner.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/infrastructure/adapters/als-tenant-context-runner.adapter.ts)
  - [payments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.service.ts)
  - [payments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.module.ts)

## Rollout PR18-C5B1 (Tenant Context Explicito en Tenancy Services)
- Objetivo: mover `tenancy/*` operativo a `TenantContextPort` para dejar `getCurrent*` solo en `tenant.context` y adapters.
- Estado:
  - `TenantConfigService` reemplaza defaults `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `TenantController` reemplaza lecturas `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `TenantPrismaService` reemplaza `getCurrentBrandId/getCurrentLocalId` por `TenantContextPort`.
  - `TenancyModule` cablea `TENANT_CONTEXT_PORT` via `AlsTenantContextAdapter`.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant-config.service.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenant-config.service.ts)
  - [tenant.controller.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenant.controller.ts)
  - [tenant-prisma.service.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenant-prisma.service.ts)
  - [tenancy.module.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenancy.module.ts)

## Rollout PR18-C5B2 (Iteracion Cross-Tenant via Ports + Platform Flag Explicito)
- Objetivo: eliminar utilidades ALS directas en jobs/crons y exponer ejecucion cross-tenant por contrato de plataforma.
- Estado:
  - nuevo port `ACTIVE_LOCATION_ITERATOR_PORT` para iterar locales activos con contexto tenant aplicado.
  - nuevo adapter Prisma `PrismaActiveLocationIteratorAdapter` que usa `TenantContextRunnerPort`.
  - jobs/schedulers (`appointments`, `payments`, `notifications`, `referrals`, `ai-memory`) reemplazan `runForEachActiveLocation` por el nuevo port.
  - `TenantController` deja de usar `isPlatformRequest()` directo y usa `TenantContextPort`.
  - `RequestContext` incorpora `isPlatform` opcional.
  - `tenant.utils.ts` eliminado (sin consumidores).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [active-location-iterator.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/active-location-iterator.port.ts)
  - [prisma-active-location-iterator.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/infrastructure/adapters/prisma-active-location-iterator.adapter.ts)
  - [request-context.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/request-context.ts)
  - [tenancy.module.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenancy.module.ts)
  - [tenant.controller.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenant.controller.ts)
  - [payments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.service.ts)
  - [appointments-status-sync.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-status-sync.service.ts)
  - [appointments-retention.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-retention.service.ts)
  - [reminders.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/reminders.service.ts)
  - [referrals.scheduler.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.scheduler.ts)
  - [ai-memory-cleanup.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-memory-cleanup.service.ts)
  - [platform-prisma-active-location-iterator.adapter.test.ts](/Users/carlos/Projects/managgio/app/backend/test/platform-prisma-active-location-iterator.adapter.test.ts)

## Rollout PR19-A1 (Tenant Context API Surface Reduction)
- Objetivo: reducir `tenant.context` a utilidades de infraestructura y eliminar helpers de acceso global en capa de aplicacion.
- Estado:
  - `getCurrentBrandId/getCurrentLocalId/isPlatformRequest` eliminados de `tenant.context`.
  - `AlsTenantContextAdapter` resuelve defaults (`DEFAULT_BRAND_ID/DEFAULT_LOCAL_ID`) y flags platform/subdomain desde `getTenantContext`.
  - sin cambios funcionales en rutas/DTO; validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant.context.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenant.context.ts)
  - [als-tenant-context.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/infrastructure/adapters/als-tenant-context.adapter.ts)

## Rollout PR19-A2 (Scope Guard Bypass via Port)
- Objetivo: encapsular el bypass del tenant scope guard en contrato de plataforma y evitar acceso directo desde servicios.
- Estado:
  - nuevo port `TENANT_SCOPE_GUARD_BYPASS_PORT` + `TenantScopeGuardBypassPort`.
  - nuevo adapter `AlsTenantScopeGuardBypassAdapter` (envolviendo `runWithTenantScopeGuardBypassAsync`).
  - `TenantPrismaService` consume el port (sin import directo de helper ALS).
  - `TenancyModule` exporta el token para uso transversal.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant-scope-guard-bypass.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/tenant-scope-guard-bypass.port.ts)
  - [als-tenant-scope-guard-bypass.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/infrastructure/adapters/als-tenant-scope-guard-bypass.adapter.ts)
  - [tenant-prisma.service.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenant-prisma.service.ts)
  - [tenancy.module.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenancy.module.ts)

## Rollout PR19-B1 (Cross-Tenant Job Contract + Observabilidad Homogenea)
- Objetivo: unificar ejecucion de crons/jobs por local con métricas consistentes, trazabilidad por `runId` e idempotencia conservada por lock distribuido.
- Estado:
  - nuevo helper `runTenantScopedJob` en `shared/application` con:
    - inicio/fin de ejecución por `jobName`,
    - `runId` por corrida,
    - métricas agregadas por ejecución,
    - conteo de locales procesados/exitosos/fallidos,
    - logging estandarizado de fallos por `brandId/localId`.
  - schedulers/jobs críticos migrados al contrato común:
    - `appointments-status-sync`,
    - `appointments-retention`,
    - `notifications-reminders`,
    - `ai-memory-cleanup`,
    - `referrals-daily`,
    - `payments-expired-cancel`.
  - tests unitarios añadidos para agregación de métricas y resiliencia ante fallos por local.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant-job-execution.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/tenant-job-execution.ts)
  - [appointments-status-sync.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-status-sync.service.ts)
  - [appointments-retention.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-retention.service.ts)
  - [reminders.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/reminders.service.ts)
  - [ai-memory-cleanup.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-memory-cleanup.service.ts)
  - [referrals.scheduler.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.scheduler.ts)
  - [payments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.service.ts)
  - [tenant-job-execution.test.ts](/Users/carlos/Projects/managgio/app/backend/test/tenant-job-execution.test.ts)

## Rollout PR19-B2 (Threshold Alerts by Job Failure Rate)
- Objetivo: añadir umbrales operativos explícitos por job para alertar desviaciones de ejecución cross-tenant.
- Estado:
  - `runTenantScopedJob` incorpora:
    - `failureRate` en `TenantJobSummary`,
    - `alertPolicy` con `failureRateWarnThreshold` y `failedLocationsWarnThreshold`,
    - emisión de `logger.warn` estructurado cuando se superan umbrales.
  - jobs críticos configuran umbrales homogéneos (`failureRate > 5%` o `>=1 local` fallido):
    - `appointments-status-sync`,
    - `appointments-retention`,
    - `notifications-reminders`,
    - `ai-memory-cleanup`,
    - `referrals-daily`,
    - `payments-expired-cancel`.
  - tests unitarios extendidos para validar trigger de alertas por umbral.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant-job-execution.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/tenant-job-execution.ts)
  - [appointments-status-sync.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-status-sync.service.ts)
  - [appointments-retention.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments-retention.service.ts)
  - [reminders.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/reminders.service.ts)
  - [ai-memory-cleanup.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-memory-cleanup.service.ts)
  - [referrals.scheduler.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.scheduler.ts)
  - [payments.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.service.ts)
  - [tenant-job-execution.test.ts](/Users/carlos/Projects/managgio/app/backend/test/tenant-job-execution.test.ts)

## Rollout PR19-C1 (Bootstrap Adapters for Global Guard/Middleware)
- Objetivo: mover el wiring global de `AppModule` hacia adapters de bootstrap y reducir acoplamiento directo con `tenancy/auth`.
- Estado:
  - nuevo adapter `TenantContextMiddleware` en `bootstrap/nest/middleware` (wrapping de `TenantMiddleware`).
  - nuevo guard `AdminGlobalGuard` en `bootstrap/nest/guards` (wrapping de `AdminGuard`).
  - `AppModule` pasa a usar adapters de bootstrap en:
    - `consumer.apply(...)` del middleware tenant,
    - `APP_GUARD` global para admin access.
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenant-context.middleware.ts](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/middleware/tenant-context.middleware.ts)
  - [admin-global.guard.ts](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/guards/admin-global.guard.ts)
  - [app.module.ts](/Users/carlos/Projects/managgio/app/backend/src/app.module.ts)

## Rollout PR19-C2 (Tenancy Module Cleanup after Bootstrap Handover)
- Objetivo: eliminar wiring duplicado de middleware tenant en `TenancyModule` tras mover composición global a bootstrap.
- Estado:
  - `TenancyModule` deja de registrar/exportar `TenantMiddleware`.
  - `TenantMiddleware` se mantiene como componente de infraestructura, consumido por `TenantContextMiddleware` (bootstrap adapter).
  - validacion completa verde (`build`, `test`, `lint`, `arch:check`).
- Componentes:
  - [tenancy.module.ts](/Users/carlos/Projects/managgio/app/backend/src/tenancy/tenancy.module.ts)
  - [tenant-context.middleware.ts](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/middleware/tenant-context.middleware.ts)

## Rollout PR19-C3 (Bootstrap/Tenancy Boundary Documentation)
- Objetivo: dejar explícitas las reglas de ownership para evitar regresiones de acoplamiento en futuras PRs.
- Estado:
  - `README` de bootstrap actualizado con reglas de frontera (`bootstrap` vs `tenancy` vs `contexts`).
  - `README` de `guards` y `middleware` actualizado con lineamientos de adapters del delivery layer.
- Componentes:
  - [README.md](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/README.md)
  - [README.md](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/guards/README.md)
  - [README.md](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/middleware/README.md)

## Rollout PR20-A (Transition Artifacts Inventory Automation)
- Objetivo: institucionalizar la limpieza final con un inventario verificable de artefactos transicionales.
- Estado:
  - script generador `generate-transition-artifacts-checklist.mjs` operativo para auditar `legacy-bridge`, `legacy-adapter` y `flag-alias`.
  - comando npm agregado para regeneracion estandarizada.
  - checklist generado en `docs/migration/transition-artifacts-checklist.md` y versionado junto al roadmap.
- Componentes:
  - [generate-transition-artifacts-checklist.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/generate-transition-artifacts-checklist.mjs)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR20-B (CI Enforcement Gate for Transition Checklist)
- Objetivo: hacer obligatorio en CI que el inventario transicional este sincronizado con el codigo.
- Estado:
  - `generate-transition-artifacts-checklist.mjs` soporta `--check` para validar desalineacion sin reescribir archivo.
  - nuevo script npm `migration:inventory:transition-artifacts:check` para usar en pipelines.
  - nuevo agregador `migration:gate:ci` que ejecuta `arch:check` + validacion de checklist.
- Componentes:
  - [generate-transition-artifacts-checklist.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/generate-transition-artifacts-checklist.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR20-C1 (Legacy Flag Alias Removal)
- Objetivo: retirar compatibilidad de aliases de flags legacy y consolidar solo capability/global flags actuales.
- Estado:
  - `appointments.flags` elimina fallback a:
    - `BOOKING_AVAILABILITY_MODE`,
    - `BOOKING_CREATE_MODE`,
    - `BOOKING_UPDATE_MODE`,
    - `BOOKING_REMOVE_MODE`.
  - tests de flags actualizados para validar precedence de:
    - capability flags,
    - `BOOKING_AVAILABILITY_READ_MODE`,
    - `BOOKING_APPOINTMENT_WRITE_MODE`.
  - checklist transicional actualizado: 4 artefactos removidos (aliases legacy).
- Componentes:
  - [appointments.flags.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.flags.ts)
  - [appointments-flags.test.ts](/Users/carlos/Projects/managgio/app/backend/test/appointments-flags.test.ts)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-C2A (Remove Unused Legacy Commerce Loyalty Adapter)
- Objetivo: eliminar artefactos legacy sin wiring activo para reducir superficie de transición sin riesgo funcional.
- Estado:
  - eliminado `legacy-commerce-loyalty-policy.adapter.ts` (no estaba registrado en providers activos).
  - test de adapters legacy ajustado para retirar cobertura del adapter eliminado y mantener cobertura de wallet legacy.
  - checklist transicional actualizado: 5 artefactos removidos acumulados.
- Componentes:
  - `commerce-loyalty-wallet.adapters.test.ts` (eliminado en PR20-C2B)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-C2B (Remove Unused Legacy Commerce Wallet Adapter)
- Objetivo: continuar limpieza de adapters legacy sin wiring activo antes de tocar bridges críticos de booking.
- Estado:
  - eliminado `legacy-commerce-wallet-ledger.adapter.ts` (sin providers activos).
  - eliminado test `commerce-loyalty-wallet.adapters.test.ts` que solo cubría adapters legacy ya retirados.
  - checklist transicional actualizado: 6 artefactos removidos acumulados.
- Componentes:
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-C3A (Booking UoW Bridge Rename/Detach)
- Objetivo: reducir artefactos legacy en booking sin alterar comportamiento transaccional del write path actual.
- Estado:
  - `legacy-booking-unit-of-work.adapter.ts` eliminado del wiring.
  - nuevo `NoopBookingUnitOfWorkAdapter` registrado para `BOOKING_UNIT_OF_WORK_PORT`.
  - comportamiento preservado (`runInTransaction` passthrough) porque las transacciones siguen controladas por command path legacy.
  - checklist transicional actualizado: 7 artefactos removidos acumulados.
- Componentes:
  - [noop-booking-unit-of-work.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/infrastructure/adapters/noop-booking-unit-of-work.adapter.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-C3B (Booking Legacy Adapters Removal)
- Objetivo: retirar adapters `legacy` de booking sin alterar comportamiento observable.
- Estado:
  - eliminados:
    - `legacy-booking-command.adapter.ts`,
    - `legacy-booking-maintenance.adapter.ts`,
    - `legacy-booking-status-side-effects.adapter.ts`.
  - nuevos adapters equivalentes:
    - `AppointmentsBookingCommandAdapter` (renombrado/movido en PR34-B2 a `ModuleBookingCommandAdapter`),
    - `AppointmentsBookingMaintenanceAdapter` (renombrado/movido en PR34-B2 a `ModuleBookingMaintenanceAdapter`),
    - `AppointmentsBookingStatusSideEffectsAdapter`.
  - wiring actualizado en `appointments.module` para usar adapters no-legacy.
  - checklist transicional actualizado: 10 artefactos removidos acumulados.
- Componentes:
  - [module-booking-command.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/adapters/module-booking-command.adapter.ts)
  - [module-booking-maintenance.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/adapters/module-booking-maintenance.adapter.ts)
  - [module-booking-status-side-effects.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/adapters/module-booking-status-side-effects.adapter.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-C3C (Appointments Legacy Bridge Removal)
- Objetivo: eliminar bridge `appointments.legacy.service` y simplificar wiring del facade.
- Estado:
  - `AppointmentsFacade` consume `AppointmentsService` directo para caminos legacy/shadow.
  - eliminado `appointments.legacy.service.ts` y su provider en `appointments.module`.
  - checklist transicional actualizado: 11 artefactos removidos acumulados.
- Componentes:
  - [appointments.facade.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.facade.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-C4 (Remaining Legacy Adapters Removal)
- Objetivo: cerrar cleanup transicional eliminando adapters legacy restantes de commerce/engagement/ai.
- Estado:
  - reemplazados y eliminados:
    - `legacy-commerce-subscription-policy.adapter.ts`,
    - `legacy-engagement-referral-attribution.adapter.ts`,
    - `legacy-engagement-referral-reward.adapter.ts`,
    - `legacy-engagement-referral-notification.adapter.ts`,
    - `legacy-ai-booking-tool.adapter.ts`,
    - `legacy-ai-holiday-tool.adapter.ts`,
    - `legacy-ai-alert-tool.adapter.ts`.
  - módulos y tests actualizados para usar adapters no-legacy.
  - checklist transicional queda en `Present: 0`, `Removed: 18`.
- Componentes:
  - [module-commerce-subscription-policy.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/adapters/module-commerce-subscription-policy.adapter.ts)
  - [engagement-referral-attribution.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/adapters/engagement-referral-attribution.adapter.ts)
  - [module-engagement-referral-reward.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/adapters/module-engagement-referral-reward.adapter.ts)
  - [module-engagement-referral-notification.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/adapters/module-engagement-referral-notification.adapter.ts)
  - [module-engagement-referral-attribution-persistence.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/adapters/module-engagement-referral-attribution-persistence.adapter.ts)
  - [module-ai-booking-tool.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/adapters/module-ai-booking-tool.adapter.ts)
  - [module-ai-holiday-tool.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/adapters/module-ai-holiday-tool.adapter.ts)
  - [module-ai-alert-tool.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/adapters/module-ai-alert-tool.adapter.ts)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR20-D1 (Zero-Present Enforcement in CI)
- Objetivo: impedir regresiones reintroduciendo artefactos transicionales.
- Estado:
  - `generate-transition-artifacts-checklist.mjs` soporta `--require-zero-present` en modo `--check`.
  - nuevo script npm `migration:inventory:transition-artifacts:enforce-zero`.
  - `migration:gate:ci` ahora ejecuta `arch:check` + `enforce-zero`.
  - checklist actual: `Present: 0`, `Removed: 18`.
- Componentes:
  - [generate-transition-artifacts-checklist.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/generate-transition-artifacts-checklist.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)
  - [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)

## Rollout PR21-A1 (Tenant Context Provider Dedup)
- Objetivo: reducir ruido de wiring eliminando providers duplicados de `TENANT_CONTEXT_PORT` en módulos que ya dependen de `TenancyModule`.
- Estado:
  - removido provider local `{ provide: TENANT_CONTEXT_PORT, useClass: AlsTenantContextAdapter }` en:
    - `appointments.module`,
    - `ai-assistant.module`,
    - `loyalty.module`,
    - `referrals.module`.
  - resolución del token se mantiene vía exports de `TenancyModule`.
  - sin cambios funcionales; `build/test/lint/migration:gate:ci` en verde.
- Componentes:
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [ai-assistant.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/ai-assistant/ai-assistant.module.ts)
  - [loyalty.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/loyalty/loyalty.module.ts)
  - [referrals.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.module.ts)

## Rollout PR21-B1 (Shared Commerce Subscription Policy Wiring)
- Objetivo: eliminar duplicación de wiring de `COMMERCE_SUBSCRIPTION_POLICY_PORT` entre módulos.
- Estado:
  - nuevo módulo compartido `CommerceSubscriptionPolicyModule` (posteriormente movido en PR34-C1 a `SubscriptionsCommerceSubscriptionPolicyModule`):
    - importa `SubscriptionsModule`,
    - registra `COMMERCE_SUBSCRIPTION_POLICY_PORT` con adapter de subscriptions,
    - exporta el token para consumo transversal.
  - `appointments`, `loyalty` y `referrals` importan el módulo compartido y eliminan wiring local duplicado.
  - sin cambios funcionales; validación completa verde (`build/test/lint/migration:gate:ci`).
- Componentes:
  - [subscriptions-commerce-subscription-policy.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions-commerce-subscription-policy.module.ts)
  - [module-commerce-subscription-policy.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/adapters/module-commerce-subscription-policy.adapter.ts)
  - [appointments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/appointments/appointments.module.ts)
  - [loyalty.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/loyalty/loyalty.module.ts)
  - [referrals.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/referrals/referrals.module.ts)

## Rollout PR21-C1 (Factory-based Adapter DI Hardening)
- Objetivo: evitar errores de DI de Nest en adapters que aceptan factories opcionales para tests (`Function` token en runtime).
- Estado:
  - `StripePaymentGatewayAdapter`, `NodemailerEmailTransportFactoryAdapter` y `TwilioClientFactoryAdapter` migrados a:
    - dependencia opcional con `@Optional()` en constructor,
    - default factory resuelta internamente (no como default param de constructor).
  - backend valida boot de Nest hasta `onModuleInit` de Prisma sin errores de DI (bloqueo actual de arranque: conectividad DB `P1001`).
  - validaciones ejecutadas en local: `build`, `test`, `migration:gate:ci`, `start:dev` (arranque parcial).
- Componentes:
  - [stripe-payment-gateway.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/adapters/stripe-payment-gateway.adapter.ts)
  - [nodemailer-email-transport-factory.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/adapters/nodemailer-email-transport-factory.adapter.ts)
  - [twilio-client-factory.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/adapters/twilio-client-factory.adapter.ts)

## Rollout PR21-C2 (Tenant Context Wiring Dedup - Wave 2)
- Objetivo: eliminar providers duplicados de contexto tenant en módulos que ya importan `TenancyModule`.
- Estado:
  - removido provider local `TENANT_CONTEXT_PORT` en:
    - `barbers`, `firebase`, `imagekit`, `notifications`, `reviews`, `settings`, `subscriptions`, `usage-metrics`, `users`.
  - `payments` elimina wiring local de:
    - `TENANT_CONTEXT_PORT`,
    - `TENANT_CONTEXT_RUNNER_PORT`.
  - resolución de ambos tokens queda centralizada vía exports de `TenancyModule`.
  - validación completa verde (`build`, `lint`, `test`, `migration:gate:ci`, `start:dev` hasta `onModuleInit` Prisma con único bloqueo externo `P1001`).
- Componentes:
  - [barbers.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/barbers/barbers.module.ts)
  - [firebase.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/firebase/firebase.module.ts)
  - [imagekit.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/imagekit/imagekit.module.ts)
  - [notifications.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/notifications.module.ts)
  - [payments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.module.ts)
  - [reviews.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/reviews/reviews.module.ts)
  - [settings.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/settings/settings.module.ts)
  - [subscriptions.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions.module.ts)
  - [usage-metrics.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/usage-metrics/usage-metrics.module.ts)
  - [users.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/users/users.module.ts)

## Rollout PR21-E (Tenant Context Wiring Dedup - Wave 3 / Cierre)
- Objetivo: eliminar wiring residual de `TENANT_CONTEXT_PORT` en módulos legacy restantes y cerrar la centralización en `TenancyModule`.
- Estado:
  - módulos migrados a `imports: [TenancyModule]` y sin provider local de `TENANT_CONTEXT_PORT`:
    - `alerts`, `audit-logs`, `cash-register`, `client-notes`, `holidays`, `legal`, `observability`,
    - `offers`, `product-categories`, `products`, `roles`, `schedules`, `service-categories`, `services`.
  - resultado global en `modules/*`:
    - `TENANT_CONTEXT_PORT` local providers: **0**.
  - validación completa verde (`build`, `lint`, `test`, `migration:gate:ci`, `start:dev` hasta `onModuleInit` Prisma; único bloqueo externo `P1001`).
- Componentes:
  - [alerts.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/alerts/alerts.module.ts)
  - [audit-logs.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/audit-logs/audit-logs.module.ts)
  - [cash-register.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/cash-register/cash-register.module.ts)
  - [client-notes.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/client-notes/client-notes.module.ts)
  - [holidays.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/holidays/holidays.module.ts)
  - [legal.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/legal/legal.module.ts)
  - [observability.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/observability/observability.module.ts)
  - [offers.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/offers/offers.module.ts)
  - [product-categories.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/product-categories/product-categories.module.ts)
  - [products.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/products/products.module.ts)
  - [roles.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/roles/roles.module.ts)
  - [schedules.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/schedules/schedules.module.ts)
  - [service-categories.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/service-categories/service-categories.module.ts)
  - [services.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/services/services.module.ts)

## Rollout PR21-D (Shared Provider Modules Normalization)
- Objetivo: consolidar wiring de puertos cross-context en módulos compartidos para eliminar duplicación de providers por módulo funcional.
- Estado:
  - nuevo `CommerceStripePaymentGatewayModule` centraliza provider/export de `COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT`.
  - nuevo `EngagementNotificationGatewayModule` centraliza providers/exports de:
    - `ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT`,
    - `ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT`.
  - `PaymentsModule`, `SubscriptionsModule` y `NotificationsModule` migrados para consumir módulos compartidos y retirar wiring local duplicado.
  - validación completa verde (`build`, `lint`, `test`, `migration:gate:ci`); smoke runtime con DB real queda documentado en `PR22-A/PR22-B`.
- Componentes:
  - [commerce-stripe-payment-gateway.module.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/modules/commerce-stripe-payment-gateway.module.ts)
  - [engagement-notification-gateway.module.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/modules/engagement-notification-gateway.module.ts)
  - [payments.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/payments/payments.module.ts)
  - [subscriptions.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/subscriptions/subscriptions.module.ts)
  - [notifications.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/notifications/notifications.module.ts)

## Rollout PR22-A (Runtime Smoke with Real DB)
- Objetivo: validar que el wiring consolidado funciona en runtime real con Prisma+MySQL activos.
- Estado:
  - comprobación de conectividad Prisma en runtime (`PrismaClient.$connect`) **OK** en ejecución elevada.
  - backend en `start:dev` llega a `Nest application successfully started` con DB conectada.
  - incidencia local detectada durante el smoke: `EADDRINUSE` en `:3000` (proceso previo ocupando el puerto), no relacionada con DI ni con Prisma connectivity.
- Evidencia:
  - `node -e "... PrismaClient.$connect ..."` => `PRISMA_CONNECT_OK`.
  - `npm run start:dev` (elevado) => arranque Nest completo + error final de puerto en uso.

## Rollout PR22-B (Capability Runtime Smoke Script)
- Objetivo: convertir el smoke de runtime en evidencia repetible por comando para capacidades críticas.
- Estado:
  - nuevo script `runtime-capability-smoke.mjs`:
    - levanta backend en puerto libre dedicado,
    - ejecuta smoke HTTP en endpoints críticos de booking/payments/notifications,
    - falla sólo ante errores operativos reales (`5xx`, startup failure, timeout).
  - nuevo comando npm:
    - `migration:smoke:runtime` (`build + smoke`).
  - ejecución validada en local (elevado) con resultados:
    - `tenant.bootstrap`: `400`,
    - `appointments.availability`: `400`,
    - `payments.availability`: `400`,
    - `appointments.create`: `400`,
    - `payments.checkout`: `400`,
    - `notifications.test-sms`: `400`.
  - criterio de éxito: rutas críticas responden sin `5xx` bajo wiring actual.
- Componentes:
  - [runtime-capability-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-capability-smoke.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR22-C (Operational Hardening Closure)
- Objetivo: blindar la operativa local para evitar falsos negativos por puerto/entorno al ejecutar runtime smoke.
- Estado:
  - `start:dev` incorpora resolución automática de puerto:
    - si `PORT` está ocupado, selecciona siguiente puerto libre y lo informa en consola.
  - nuevo `migration:runtime:preflight`:
    - valida disponibilidad de puerto configurado,
    - valida conectividad Prisma real.
  - `migration:smoke:runtime` ahora ejecuta:
    - `build`,
    - `runtime:preflight`,
    - smoke por capabilities.
  - validación operativa:
    - `start:dev` probado con conflicto real de `:3000` y fallback correcto a `:3001` (`Nest application successfully started`).
    - `migration:smoke:runtime` verde con preflight + smoke.
- Componentes:
  - [start-dev.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/start-dev.mjs)
  - [runtime-preflight.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-preflight.mjs)
  - [runtime-capability-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-capability-smoke.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR23-A (Authenticated Runtime Smoke)
- Objetivo: añadir validación operativa autenticada para rutas críticas sin depender de credenciales Firebase reales en local/staging.
- Estado:
  - `FirebaseAdminService` soporta bypass local no-productivo controlado por flags:
    - `AUTH_DEV_BYPASS_ENABLED=true`,
    - prefijo configurable `AUTH_DEV_BYPASS_PREFIX` (default `dev:`),
    - deshabilitado en `NODE_ENV=production`.
  - nuevo script `runtime-authenticated-smoke.mjs`:
    - selecciona actor(es) desde DB (`firebaseUid`) con Prisma,
    - arranca backend en puerto efímero con bypass local,
    - ejecuta smoke autenticado sobre capacidades de users/subscriptions/referrals/booking/payments.
  - comando npm reproducible:
    - `migration:smoke:runtime:auth` (`build + preflight + auth smoke`).
  - unit tests de bypass añadidos para evitar regresiones de seguridad en entorno no-prod.
- Evidencia:
  - `npm test -- --runInBand` verde (incluye `firebase-admin-auth-dev-bypass.test.ts`).
  - `npm run migration:smoke:runtime:auth` verde en ejecución elevada con Prisma conectando OK.
- Componentes:
  - [firebase-admin.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/firebase/firebase-admin.service.ts)
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)
  - [firebase-admin-auth-dev-bypass.test.ts](/Users/carlos/Projects/managgio/app/backend/test/firebase-admin-auth-dev-bypass.test.ts)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR23-B (Runtime Parity Smoke Legacy vs V2)
- Objetivo: validar por comando la equivalencia estructural entre modos `legacy` y `v2` en booking read.
- Estado:
  - nuevo script `runtime-parity-smoke.mjs`:
    - resuelve fixture desde DB (brand/local/barber/service/date),
    - arranca backend dos veces (`legacy` y `v2`) con flags por capability,
    - ejecuta requests sobre:
      - `GET /appointments/availability`,
      - `GET /appointments/availability-batch`,
      - `GET /appointments/weekly-load`,
    - compara status + payload normalizado (sort arrays + ignore volatile keys).
  - comando npm reproducible:
    - `migration:smoke:runtime:parity` (`build + preflight + parity smoke`).
  - fallback de selección de local robustecido:
    - prioridad a `defaultLocation`,
    - fallback a locales activos con barbero operativo.
- Evidencia:
  - `npm run migration:smoke:runtime:parity` verde en ejecución elevada con Prisma conectando OK.
  - salida de parity: `PASS` en los 3 casos (`single`, `batch`, `weekly-load`) con `status=200` en ambos modos.
- Componentes:
  - [runtime-parity-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-parity-smoke.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR24-A (Tenant-Aware Deterministic Fixtures)
- Objetivo: subir señal funcional de smoke/paridad minimizando `400` por desalineación de tenant/local.
- Estado:
  - `runtime-parity-smoke.mjs` ahora fija contexto tenant explícito en cada request:
    - headers `x-local-id` + `x-tenant-subdomain`,
    - `TENANT_ALLOW_HEADER_OVERRIDES=true` en el runtime del smoke.
  - `runtime-authenticated-smoke.mjs` adopta el mismo enfoque tenant-aware y resuelve `subdomain/localId` desde DB.
  - normalización de `Host` en los scripts de runtime usando `TENANT_BASE_DOMAIN` (fallback seguro a `*.localhost`).
- Evidencia:
  - parity runtime con fixture tenant-aware:
    - `booking.availability.single`: `200/200`,
    - `booking.availability.batch`: `200/200`,
    - `booking.weekly-load`: `200/200`.
  - authenticated runtime smoke mejora de señal:
    - `auth.users.by-firebase.self`: `200`,
    - `auth.referrals.my-summary`: `200`.
- Componentes:
  - [runtime-parity-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-parity-smoke.mjs)
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)
  - [runtime-capability-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-capability-smoke.mjs)

## Rollout PR24-B (Optional Release Gate)
- Objetivo: convertir los smokes operativos en un gate de release activable por entorno con umbrales explícitos.
- Estado:
  - nuevo orquestador `release-gate.mjs` ejecuta checks configurables:
    - `runtime` (`runtime-capability-smoke.mjs`),
    - `auth` (`runtime-authenticated-smoke.mjs`),
    - `parity` (`runtime-parity-smoke.mjs`).
  - modo opcional por defecto:
    - `migration:gate:release` no bloquea si `MIGRATION_RELEASE_GATE_ENABLED=false`.
  - modo enforce reproducible:
    - `migration:gate:release:enforce` ejecuta `build + preflight + gate` con `MIGRATION_RELEASE_GATE_ENABLED=true`.
  - umbrales explícitos soportados:
    - `MIGRATION_RELEASE_GATE_MIN_PASS_RATE` (default `1.0`),
    - `MIGRATION_RELEASE_GATE_MAX_FAILED_CHECKS` (default `0`),
    - `MIGRATION_RELEASE_GATE_CHECKS` (histórico PR24-B; default actual por perfil: `runtime,auth` desde PR36-A).
- Evidencia:
  - `npm run migration:gate:release:staging` verde con `profile=staging` (`passed=3/3`, `passRate=1.000`).
  - `npm run migration:gate:release` => `SKIPPED` controlado cuando el gate no está habilitado.
  - `npm run migration:gate:release:enforce` verde con:
    - `total=3`, `passed=3`, `failed=0`, `passRate=1.000`.
- Componentes:
  - [release-gate.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/release-gate.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)

## Rollout PR24-C (Authenticated Write Payload Hardening)
- Objetivo: validar write-path autenticado con payloads reales para subir señal funcional más allá de `400` controlados.
- Estado:
  - `runtime-authenticated-smoke.mjs` resuelve fixture operativo automáticamente:
    - selección de `local` con barberos/servicios válidos (fallback sobre locales activos de la marca),
    - descubrimiento de slot disponible por `availability-batch` (fecha/barbero/servicio).
  - write check de `create` pasa a payload válido:
    - `POST /appointments` con `barberId/serviceId/startDateTime` reales,
    - resultado esperado `2xx` (evidencia actual: `201`).
  - write check de `checkout` pasa a payload válido:
    - si Stripe está disponible: ejecuta `POST /payments/stripe/checkout` con datos reales,
    - si Stripe no está disponible: marca `SKIP` explícito (`stripe_unavailable`) sin false negative del gate.
  - cleanup best-effort de citas creadas por smoke (`DELETE /appointments/:id`) para minimizar ruido de datos.
- Evidencia:
  - `migration:smoke:runtime:auth`:
    - `auth.appointments.create.valid`: `201`,
    - `auth.payments.checkout.valid`: `SKIP (stripe_unavailable)` con payload válido preparado.
  - `migration:gate:release:enforce` permanece verde (`passed=3/3`) después del refactor.
- Componentes:
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)

## Rollout PR24-D (Release Gate Environment Policy + Rollback)
- Objetivo: formalizar activación por entorno del gate de release y definir rollback operacional sin cambios de código.
- Estado:
  - `release-gate.mjs` soporta perfiles declarativos:
    - `MIGRATION_RELEASE_GATE_PROFILE=staging|canary|prod`,
    - defaults por perfil para `enabled/checks/minPassRate/maxFailedChecks`,
    - override explícito por env vars individuales.
  - scripts npm por entorno añadidos:
    - `migration:gate:release:staging`,
    - `migration:gate:release:canary`,
    - `migration:gate:release:prod`.
  - runbook operativo publicado con:
    - matriz de activación por entorno,
    - procedimiento de rollback inmediato (`MIGRATION_RELEASE_GATE_ENABLED=false`),
    - criterios por severidad de fallo (`runtime/auth/parity`).
- Evidencia:
  - `migration:gate:release:enforce` verde tras introducir perfiles (`passRate=1.000`).
  - `migration:gate:release` mantiene comportamiento opcional local (`SKIPPED` por defecto).
- Componentes:
  - [release-gate.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/release-gate.mjs)
  - [package.json](/Users/carlos/Projects/managgio/app/backend/package.json)
  - [release-gate-policy.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/release-gate-policy.md)

## Rollout PR24-E (Runtime Capability Smoke 2xx Upgrade)
- Objetivo: convertir el smoke runtime base de validación `no 5xx` a señal funcional `2xx` con payloads válidos y contexto tenant explícito.
- Estado:
  - `runtime-capability-smoke.mjs` ahora:
    - resuelve fixture real (`brand/local/barbers/services`) con Prisma,
    - fuerza contexto tenant (`Host` + `x-local-id` + `x-tenant-subdomain`),
    - descubre slot válido por `availability-batch`,
    - ejecuta checks con payload válido en:
      - `tenant.bootstrap`,
      - `appointments.availability.single.valid`,
      - `appointments.availability.batch.valid`,
      - `appointments.create.valid`,
      - `payments.availability`,
      - `payments.checkout.valid` (con `SKIP` explícito si Stripe no está disponible),
    - limpia citas creadas por smoke (`DELETE /appointments/:id`) en best-effort.
  - el runtime del smoke habilita `TENANT_ALLOW_HEADER_OVERRIDES=true` para consistencia en entornos locales/canary.
- Evidencia:
  - `migration:smoke:runtime`:
    - `tenant.bootstrap`: `200`,
    - `appointments.availability.single.valid`: `200`,
    - `appointments.availability.batch.valid`: `200`,
    - `appointments.create.valid`: `201`,
    - `payments.availability`: `200`,
    - `payments.checkout.valid`: `SKIP (stripe_unavailable)`.
  - `migration:gate:release:staging` permanece verde con el runtime upgrade (`passRate=1.000`).
- Componentes:
  - [runtime-capability-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-capability-smoke.mjs)

## Rollout PR24-F (Release Gate Checkout Coverage Hardening)
- Objetivo: impedir promociones donde `checkout` quede en `SKIP` en entornos que declaran Stripe operativo.
- Estado:
  - `runtime-capability-smoke` y `runtime-authenticated-smoke` emiten resumen estructurado por ejecución:
    - prefijo: `[migration:smoke:summary]`
    - payload: `smokeId + checkout{name,status,ok,skipped,reason}`.
  - `release-gate` parsea ese resumen y agrega política de cobertura:
    - `MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT`,
    - `MIGRATION_RELEASE_GATE_MIN_CHECKOUT_NON_SKIP`.
  - perfiles `canary/prod` exigen cobertura por defecto (`requireStripeCheckoutCoverage=true`), `staging` mantiene default relajado (`false`).
- Criterio de fallo nuevo:
  - falta de resumen estructurado en `runtime/auth`,
  - `checkout` marcado como `SKIP`,
  - `nonSkipCount < minCheckoutNonSkip`.
- Evidencia:
  - configuración registrada en log del gate:
    - `requireStripeCheckoutCoverage=...`
    - `minCheckoutNonSkip=...`
  - runbook actualizado con variables y reglas de rollback controlado.
- Componentes:
  - [release-gate.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/release-gate.mjs)
  - [runtime-capability-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-capability-smoke.mjs)
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)
  - [release-gate-policy.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/release-gate-policy.md)

## Rollout PR25-A (CRUD Pilot: Roles en Identity Context)
- Objetivo: iniciar fase CRUD target con un módulo low-risk real, sin cambiar API HTTP.
- Estado:
  - `contexts/identity` incorpora contratos y casos de uso para `roles`:
    - queries/commands (`get/create/update/remove`),
    - use-cases puros de aplicación,
    - `IDENTITY_ADMIN_ROLE_REPOSITORY_PORT` (outbound).
  - adapter Prisma implementado en infraestructura (`PrismaAdminRoleRepositoryAdapter`).
  - `RolesService` deja de usar `PrismaService` directo y pasa a orquestar use-cases + tenant context.
  - mapeo de `ROLE_NOT_FOUND` a `NotFoundException` queda en adapter layer (`modules/roles`), no en core.
- Evidencia:
  - test unitario nuevo: `identity-admin-roles.usecases.test.ts`.
- Componentes:
  - [roles.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/roles/roles.service.ts)
  - [roles.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/roles/roles.module.ts)
  - [admin-role-repository.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/identity/ports/outbound/admin-role-repository.port.ts)
  - [prisma-admin-role-repository.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/identity/infrastructure/prisma/prisma-admin-role-repository.adapter.ts)
  - [identity-admin-roles.usecases.test.ts](/Users/carlos/Projects/managgio/app/backend/test/identity-admin-roles.usecases.test.ts)

## Rollout PR25-B (CRUD Expansion: Alerts + Service Categories)
- Objetivo: extender patrón target a dos módulos CRUD low-risk sin modificar endpoints/DTOs.
- Estado:
  - `alerts` migrado a `contexts/engagement`:
    - `Get/Create/Update/RemoveAlertUseCase`,
    - `ENGAGEMENT_ALERT_REPOSITORY_PORT`,
    - adapter Prisma (`PrismaAlertRepositoryAdapter`),
    - validación de rango de fechas en application (`ALERT_INVALID_DATE_RANGE`).
  - `service-categories` migrado a `contexts/commerce`:
    - `Get/Create/Update/RemoveServiceCategoryUseCase`,
    - `COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT`,
    - adapter Prisma (`PrismaServiceCategoryRepositoryAdapter`),
    - regla de borrado protegida en application (`CATEGORY_HAS_ASSIGNED_SERVICES`).
  - `AlertsService` y `ServiceCategoriesService` quedan como adapters Nest/HTTP:
    - orquestan use-cases,
    - traducen `DomainError` a `NotFound/BadRequest` HTTP.
- Evidencia:
  - tests unitarios nuevos:
    - `engagement-alerts.usecases.test.ts`,
    - `commerce-service-categories.usecases.test.ts`.
  - `npm run build` verde.
  - `npm run arch:check` verde.
- Componentes:
  - [alerts.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/alerts/alerts.service.ts)
  - [alerts.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/alerts/alerts.module.ts)
  - [prisma-alert-repository.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/prisma/prisma-alert-repository.adapter.ts)
  - [service-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/service-categories/service-categories.service.ts)
  - [service-categories.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/service-categories/service-categories.module.ts)
  - [prisma-service-category-repository.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/prisma/prisma-service-category-repository.adapter.ts)

## Rollout PR25-C (Adapter Consolidation + CRUD Capability Smoke)
- Objetivo: consolidar adapter HTTP de CRUD migrados y cerrar regresión operacional por capability.
- Estado:
  - se unifica el mapping `DomainError -> HttpException` en helper compartido:
    - `rethrowDomainErrorAsHttp`.
  - `roles`, `alerts` y `service-categories` adoptan el helper compartido para reducir duplicación en adapters Nest.
  - `runtime-authenticated-smoke` amplía cobertura con flujo CRUD real (create/update/delete) para:
    - `roles`,
    - `alerts`,
    - `service-categories`.
  - los checks CRUD se ejecutan incluso si checkout Stripe queda en `SKIP`.
- Evidencia:
  - `migration:smoke:runtime:auth` verde con capacidades CRUD:
    - `auth.crud.roles.*`,
    - `auth.crud.alerts.*`,
    - `auth.crud.service-categories.*`.
  - `npm run build` verde.
  - `npm run arch:check` verde.
- Componentes:
  - [rethrow-domain-error-as-http.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/interfaces/http/rethrow-domain-error-as-http.ts)
  - [roles.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/roles/roles.service.ts)
  - [alerts.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/alerts/alerts.service.ts)
  - [service-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/service-categories/service-categories.service.ts)
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)

## Rollout PR25-D (CRUD Expansion: Product Categories + Client Notes)
- Objetivo: migrar siguiente bloque CRUD low-risk a arquitectura target sin romper APIs.
- Estado:
  - `product-categories` migrado a `contexts/commerce`:
    - `Get/Create/Update/RemoveProductCategoryUseCase`,
    - `COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT`,
    - adapter Prisma (`PrismaProductCategoryRepositoryAdapter`),
    - regla de borrado protegida (`PRODUCT_CATEGORY_HAS_ASSIGNED_PRODUCTS`).
  - `client-notes` migrado a `contexts/engagement`:
    - `List/Create/Update/RemoveClientNoteUseCase`,
    - `ENGAGEMENT_CLIENT_NOTE_REPOSITORY_PORT`,
    - adapter Prisma (`PrismaClientNoteRepositoryAdapter`),
    - invariantes de contenido/límite movidas a application (`MAX_NOTE_LENGTH`, `MAX_CLIENT_NOTES`).
  - `ProductCategoriesService` y `ClientNotesService` quedan como adapters Nest/HTTP con traducción `DomainError -> HttpException`.
- Evidencia:
  - tests unitarios nuevos:
    - `commerce-product-categories.usecases.test.ts`,
    - `engagement-client-notes.usecases.test.ts`.
  - `npm run build` verde.
  - `npm run arch:check` verde.
- Componentes:
  - [product-categories.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/product-categories/product-categories.service.ts)
  - [product-categories.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/product-categories/product-categories.module.ts)
  - [prisma-product-category-repository.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/infrastructure/prisma/prisma-product-category-repository.adapter.ts)
  - [client-notes.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/client-notes/client-notes.service.ts)
  - [client-notes.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/client-notes/client-notes.module.ts)
  - [prisma-client-note-repository.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/infrastructure/prisma/prisma-client-note-repository.adapter.ts)

## Rollout PR25-E (Smoke CRUD Extension: Product Categories + Client Notes)
- Objetivo: cerrar regresión operacional del bloque `PR25-D` en smoke autenticado por capability.
- Estado:
  - `runtime-authenticated-smoke` amplía checks CRUD para:
    - `product-categories` (`create/update/delete`),
    - `client-notes` (`list/create/update/delete`).
  - si no existe fixture de cliente en el tenant de prueba, `client-notes` queda en `SKIP` explícito (`client-user-missing`) sin romper ejecución global del smoke.
- Evidencia:
  - `migration:smoke:runtime:auth` verde con:
    - `auth.crud.product-categories.*` en `PASS`,
    - `auth.crud.client-notes.*` en `PASS` o `SKIP` explícito por fixture.
- Componentes:
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)

## Rollout PR26-A (CRUD Expansion: Holidays + Schedules)
- Objetivo: migrar `holidays` y `schedules` al patrón target dentro de `contexts/booking` sin cambiar API HTTP.
- Estado:
  - `holidays` migra a use-cases + port + adapter:
    - `Get/Add/RemoveGeneralHolidayUseCase`,
    - `Get/Add/RemoveBarberHolidayUseCase`,
    - `HOLIDAY_MANAGEMENT_PORT`,
    - `PrismaHolidayManagementAdapter`.
  - `schedules` migra a use-cases + port + adapter:
    - `Get/UpdateShopScheduleUseCase`,
    - `Get/UpdateBarberScheduleUseCase`,
    - `SCHEDULE_MANAGEMENT_PORT`,
    - `PrismaScheduleManagementAdapter`.
  - `HolidaysService` y `SchedulesService` quedan como adapters Nest/HTTP que orquestan casos de uso.
- Evidencia:
  - test unitario nuevo:
    - `booking-holidays-schedules.usecases.test.ts`.
  - `npm run build` verde.
  - `npm run arch:check` verde.
- Componentes:
  - [holidays.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/holidays/holidays.service.ts)
  - [holidays.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/holidays/holidays.module.ts)
  - [schedules.service.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/schedules/schedules.service.ts)
  - [schedules.module.ts](/Users/carlos/Projects/managgio/app/backend/src/modules/schedules/schedules.module.ts)
  - [prisma-holiday-management.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/infrastructure/prisma/prisma-holiday-management.adapter.ts)
  - [prisma-schedule-management.adapter.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/infrastructure/prisma/prisma-schedule-management.adapter.ts)

## Rollout PR26-B (Smoke CRUD Extension: Holidays + Schedules)
- Objetivo: cerrar regresión operacional del bloque `PR26-A` en smoke autenticado por capability.
- Estado:
  - `runtime-authenticated-smoke` amplía checks CRUD para:
    - `schedules.shop` (`get/update`),
    - `schedules.barber` (`get/update`),
    - `holidays.general` (`add/remove`),
    - `holidays.barber` (`add/remove`).
  - checks se ejecutan con actor admin autenticado y contexto tenant explícito.
- Evidencia:
  - `migration:smoke:runtime:auth` verde con:
    - `auth.crud.schedules.*` en `PASS`,
    - `auth.crud.holidays.*` en `PASS`.
- Componentes:
  - [runtime-authenticated-smoke.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/runtime-authenticated-smoke.mjs)

## Contratos Base (definidos)
- RequestContext final: [request-context.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/request-context.ts)
- Tenant context port: [tenant-context.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/tenant-context.port.ts)
- Tenant execution ports: [tenant-context-runner.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/tenant-context-runner.port.ts), [active-location-iterator.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/active-location-iterator.port.ts), [tenant-scope-guard-bypass.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/platform/ports/outbound/tenant-scope-guard-bypass.port.ts)
- Tenant job contract: [tenant-job-execution.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/tenant-job-execution.ts)
- UnitOfWork port: [unit-of-work.port.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/unit-of-work.port.ts)
- Clock port: [clock.port.ts](/Users/carlos/Projects/managgio/app/backend/src/shared/application/clock.port.ts)
- Availability read ports: [booking/ports/outbound](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/ports/outbound)
- Commerce pricing/subscription/loyalty/wallet ports: [service-pricing.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/service-pricing.port.ts), [subscription-policy.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/subscription-policy.port.ts), [loyalty-policy.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/loyalty-policy.port.ts), [loyalty-policy-read.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/loyalty-policy-read.port.ts), [wallet-ledger.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/commerce/ports/outbound/wallet-ledger.port.ts)
- Engagement ports: [referral-attribution.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/referral-attribution.port.ts)
- Engagement persistence ports: [referral-attribution-persistence.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/engagement/ports/outbound/referral-attribution-persistence.port.ts)
- Create command + use case: [create-appointment.command.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/commands/create-appointment.command.ts), [create-appointment.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/use-cases/create-appointment.use-case.ts)
- Update/remove commands + use cases: [update-appointment.command.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/commands/update-appointment.command.ts), [remove-appointment.command.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/commands/remove-appointment.command.ts), [update-appointment.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/use-cases/update-appointment.use-case.ts), [remove-appointment.use-case.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/application/use-cases/remove-appointment.use-case.ts)
- Write ports: [booking-command.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/ports/outbound/booking-command.port.ts), [booking-unit-of-work.port.ts](/Users/carlos/Projects/managgio/app/backend/src/contexts/booking/ports/outbound/booking-unit-of-work.port.ts)

## Inventario Automatico
- Inventario actualizado de appointments: [inventory-appointments.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/inventory-appointments.md)
- Checklist de artefactos transicionales: [transition-artifacts-checklist.md](/Users/carlos/Projects/managgio/app/backend/docs/migration/transition-artifacts-checklist.md)
- Regenerar con:
  - `cd backend && npm run migration:inventory:appointments`
  - `cd backend && npm run migration:inventory:transition-artifacts`
  - `cd backend && npm run migration:inventory:transition-artifacts:check`
  - `cd backend && npm run migration:inventory:transition-artifacts:enforce-zero`
  - `cd backend && npm run migration:gate:ci`

## Primera Ejecucion (estado)
1. Inventario automatico:
   - Endpoints + paths + handlers de `appointments`: **hecho**.
   - Import graph + DI graph + reverse graph de `appointments.service.ts`: **hecho**.
2. Definicion de contratos:
   - `RequestContext` final + `UnitOfWorkPort` + `ClockPort`: **hecho**.
   - Ports read de availability: **hecho**.
3. PR1 (scaffold + facade + flags + guardrails + shadow harness sin romper contratos HTTP): **hecho**.
4. PR2 (availability engine + unit tests con fakes): **hecho**.
5. PR3 (adapters read + parity shadow): **hecho**.

## Riesgos Abiertos
- Riesgo de drift funcional entre legacy y v2 en availability (timezone/breaks/overflow).
- Riesgo de side effects duplicados al migrar write path.
- Riesgo de fuga de tenant scope en adapters mixtos legacy+nuevo.
- Riesgo residual: falsos negativos en `canary/prod` si el tenant de smoke no tiene Stripe realmente operativo; mitigación: fixture canario con Stripe habilitado + override temporal documentado (`MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT=false`).
- Riesgo residual: checks CRUD de `client-notes` pueden quedar en `SKIP` si no existe usuario cliente en el tenant fixture; mitigación: seed canario con al menos 1 cliente activo por brand.

## Decision Log Rapido
- 2026-03-04: piloto oficial = Booking/Availability (read primero, write despues).
- 2026-03-04: strangler obligatorio por capability con fallback inmediato a legacy.
- 2026-03-04: Booking no depende directo de `SubscriptionsService`; dependencia entra por ACL `CommerceSubscriptionPolicyPort`.
- 2026-03-04: Loyalty/Referrals tambien consumen politica de suscripciones via ACL de commerce.
- 2026-03-04: Booking no depende directo de `LoyaltyService`/`RewardsService`; usa ACLs de commerce (`CommerceLoyaltyPolicyPort`, `CommerceWalletLedgerPort`).
- 2026-03-04: reglas de descuento de cupon y progreso loyalty viven en `commerce/domain` y se reutilizan desde legacy.
- 2026-03-04: path de appointments para `resolveRewardDecision` corre en use case de `commerce/application` con read adapter Prisma.
- 2026-03-04: path de appointments para wallet/coupon (`validate/getAvailable/reserve`) corre en `BookingWalletLedgerUseCase` con persistencia Prisma.
- 2026-03-04: booking usa ACL de `engagement` para attribution de referidos; `AppointmentsService` ya no depende directo de `ReferralAttributionService`.
- 2026-03-04: path booking de referral attribution (`resolve+attach`) corre en use cases de `engagement/application` con persistencia Prisma.
- 2026-03-04: side effects de referral (`cancel/completed/rewarding/notificaciones`) corren en `engagement/application` via puertos (`reward`/`notification`) y adapter Prisma.
- 2026-03-04: `payments` deja de instanciar SDK Stripe directo y consume `CommerceStripePaymentGatewayPort` con contract tests de webhook/checkout.
- 2026-03-04: `subscriptions` tambien consume `CommerceStripePaymentGatewayPort`; PR15 (Stripe adapters + webhook contract tests) cerrado.
- 2026-03-04: `notifications` deja de importar SDKs `nodemailer/twilio` y consume puertos de infraestructura (`email transport` + `twilio client factory`); PR16 cerrado.
- 2026-03-04: `ai-tools.registry` deja de depender directo de servicios de `appointments/holidays/alerts` mediante ACL ports en `contexts/ai-orchestration` (PR17-A).
- 2026-03-04: `ai-tools.registry` deja de consultar `PrismaService` directo y usa `AiToolsReadPort` (PR17-B).
- 2026-03-04: `ai-assistant.service` y `ai-assistant.guard` usan `AiAdminAccessReadPort` (sin Prisma directo) y comienzan migracion a `TenantContextPort` (PR17-C + PR18-A).
- 2026-03-04: `ai-tools.registry` deja de usar `getCurrentLocalId/getCurrentBrandId` y consume `TenantContextPort` (PR18-B).
- 2026-03-04: `firebase-admin.service` deja de usar `getCurrentBrandId` y consume `TenantContextPort` (PR18-C1).
- 2026-03-04: modulo `users` deja de usar `getCurrentBrandId/getCurrentLocalId` y consume `TenantContextPort` en service/controller (PR18-C2).
- 2026-03-04: bloque platform/admin (`usage-metrics`, `audit-logs`, `observability`, `admin-guard`, `payments/referrals admin`) deja de usar `getCurrent*` y consume `TenantContextPort` (PR18-C3A).
- 2026-03-04: `RequestContext` incorpora `subdomain` opcional para trazabilidad de observabilidad sin acoplarse a helpers ALS.
- 2026-03-04: `notifications` y `reminders` dejan de usar `getCurrentBrandId/getCurrentLocalId` y consumen `TenantContextPort` (PR18-C4A).
- 2026-03-04: CRUD low-risk (`alerts/roles/service-categories/product-categories/holidays/schedules`) deja de usar `getCurrentLocalId` y consume `TenantContextPort` (PR18-C4B).
- 2026-03-04: `client-notes` y `settings` dejan de usar `getCurrentBrandId/getCurrentLocalId` y consumen `TenantContextPort` (PR18-C4C).
- 2026-03-04: `reviews` (`review-request/review-config/review-analytics`) deja de usar `getCurrentLocalId` y consume `TenantContextPort` (PR18-C4D).
- 2026-03-04: `services/products/offers` dejan de usar `getCurrentLocalId` y consumen `TenantContextPort`; utilidades de categoria/productos pasan a scope explicito (PR18-C4E).
- 2026-03-04: `barbers` y `cash-register` dejan de usar `getCurrentLocalId/getCurrentBrandId` y consumen `TenantContextPort` (PR18-C4F).
- 2026-03-04: `ai-memory` e `imagekit` dejan de usar helpers ALS (`getCurrent*`/`getTenantContext`) y consumen `TenantContextPort` (PR18-C4G).
- 2026-03-04: `referral-code`, `referral-config` y `referrals.scheduler` dejan de usar `getCurrentLocalId` y consumen `TenantContextPort` (PR18-C4H).
- 2026-03-04: `referral-attribution` y `rewards` dejan de usar `getCurrentLocalId` y consumen `TenantContextPort`; tests de referidos adaptados al nuevo constructor (PR18-C4I).
- 2026-03-04: `loyalty` deja de usar `getCurrentLocalId` y consume `TenantContextPort` (PR18-C4J).
- 2026-03-04: `legal` deja de usar `getCurrentBrandId/getCurrentLocalId` y consume `TenantContextPort` (PR18-C4K).
- 2026-03-04: `subscriptions`, `payments` y `appointments` dejan de usar `getCurrent*` y consumen `TenantContextPort`; `modules/*` y `auth/*` quedan sin `getCurrent*` (PR18-C4L).
- 2026-03-04: `payments` deja de usar `runWithTenantContextAsync` directo; el bridge de contexto pasa a `TenantContextRunnerPort` con adapter ALS en `platform/infrastructure` (PR18-C5A).
- 2026-03-04: `tenant-config`, `tenant.controller` y `tenant-prisma` dejan de usar `getCurrent*`; `getCurrent*` queda aislado a `tenant.context` + adapters platform (PR18-C5B1).
- 2026-03-04: jobs/crons migran de `runForEachActiveLocation` a `ACTIVE_LOCATION_ITERATOR_PORT` con adapter Prisma+runner, `tenant.controller` deja `isPlatformRequest` directo y se elimina `tenant.utils.ts` (PR18-C5B2).
- 2026-03-04: `tenant.context` elimina helpers `getCurrent*`/`isPlatformRequest`; defaults/flags quedan en `AlsTenantContextAdapter` para mantener ALS solo en infraestructura (PR19-A1).
- 2026-03-04: bypass de scope guard queda encapsulado en `TENANT_SCOPE_GUARD_BYPASS_PORT`; `TenantPrismaService` deja de importar helper ALS directo (PR19-A2).
- 2026-03-04: se agrega test de contrato para iteracion cross-tenant (`PrismaActiveLocationIteratorAdapter`) para blindar orden/propagacion de contexto y errores.
- 2026-03-04: se estandariza la ejecución de jobs cross-tenant con `runTenantScopedJob` (runId + métricas agregadas + errores por local) para observabilidad homogénea por capability (PR19-B1).
- 2026-03-04: `runTenantScopedJob` incorpora alertas por umbral (`failureRate`/`failedLocations`) y los jobs críticos quedan con política homogénea de warning operacional (PR19-B2).
- 2026-03-04: `AppModule` deja wiring directo de `tenancy/auth` para guard/middleware globales y pasa a adapters de bootstrap (`AdminGlobalGuard`, `TenantContextMiddleware`) (PR19-C1).
- 2026-03-04: `TenancyModule` elimina registro/export de `TenantMiddleware`; la composición global queda centralizada en bootstrap (`TenantContextMiddleware`) (PR19-C2).
- 2026-03-04: frontera de ownership bootstrap/tenancy documentada en `bootstrap/nest/README` (y subcarpetas `guards`/`middleware`) para prevenir regresiones de acoplamiento (PR19-C3).
- 2026-03-04: se institucionaliza inventario de artefactos transicionales (`legacy-*` + `flag-alias`) con script dedicado y checklist versionado para ejecutar cleanup por fase (PR20-A).
- 2026-03-04: CI incorpora gate de sincronización para checklist transicional (`migration:inventory:transition-artifacts:check`) integrado en `migration:gate:ci` junto a `arch:check` (PR20-B).
- 2026-03-04: se retiran aliases legacy `BOOKING_*_MODE` de `appointments.flags`; queda solo esquema capability/global y checklist transicional marca 4 artefactos removidos (PR20-C1).
- 2026-03-04: se elimina `legacy-commerce-loyalty-policy.adapter` al no tener wiring activo; checklist transicional sube a 5 artefactos removidos (PR20-C2A).
- 2026-03-04: se elimina `legacy-commerce-wallet-ledger.adapter` (sin wiring activo) y su test dedicado; checklist transicional sube a 6 artefactos removidos (PR20-C2B).
- 2026-03-04: `legacy-booking-unit-of-work.adapter` se reemplaza por `NoopBookingUnitOfWorkAdapter`; comportamiento transaccional preservado y checklist transicional sube a 7 artefactos removidos (PR20-C3A).
- 2026-03-04: booking elimina adapters `legacy` de command/maintenance/side-effects y adopta adapters equivalentes no-legacy; checklist transicional sube a 10 artefactos removidos (PR20-C3B).
- 2026-03-04: `appointments.legacy.service` se elimina y `AppointmentsFacade` consume `AppointmentsService` directo; checklist transicional sube a 11 artefactos removidos (PR20-C3C).
- 2026-03-04: se reemplazan/remueven adapters legacy restantes de commerce/engagement/ai; checklist transicional queda en `Present: 0`, `Removed: 18` (PR20-C4).
- 2026-03-04: `migration:gate:ci` pasa a exigir `--require-zero-present` para evitar reintroducción de artefactos transicionales en PRs futuros (PR20-D1).
- 2026-03-04: se elimina wiring duplicado de `TENANT_CONTEXT_PORT` en módulos que ya importan `TenancyModule`; resolución queda centralizada en exports de `TenancyModule` (PR21-A1).
- 2026-03-04: se consolida el wiring de `COMMERCE_SUBSCRIPTION_POLICY_PORT` en `CommerceSubscriptionPolicyModule`, eliminando duplicación en `appointments/loyalty/referrals` (PR21-B1).
- 2026-03-04: adapters factory-based (`Stripe/Nodemailer/Twilio`) endurecen DI de Nest con `@Optional` y factory default interna para evitar inyección de token `Function` (PR21-C1).
- 2026-03-04: segunda ola de deduplicación tenant en módulos con `TenancyModule`; `payments` deja wiring local de `TENANT_CONTEXT_PORT/TENANT_CONTEXT_RUNNER_PORT` y centraliza resolución en exports de `TenancyModule` (PR21-C2).
- 2026-03-04: cierre de deduplicación tenant en `modules/*`; no quedan providers locales de `TENANT_CONTEXT_PORT` y toda resolución pasa por `TenancyModule` (PR21-E).
- 2026-03-04: providers cross-context de Stripe y Notification gateways se normalizan en módulos compartidos para evitar duplicación de wiring en `payments/subscriptions/notifications` (PR21-D).
- 2026-03-04: smoke runtime con DB real confirma conectividad Prisma y arranque completo de Nest; incidencia operativa restante en local es `EADDRINUSE` por puerto 3000 ocupado (PR22-A).
- 2026-03-04: se agrega `migration:smoke:runtime` para validar por comando las capacidades críticas sin `5xx` (smoke operacional repetible, PR22-B).
- 2026-03-04: `start:dev` incorpora auto-fallback de puerto y `migration:runtime:preflight` (DB+puerto), cerrando hardening operacional de ejecución local (PR22-C).
- 2026-03-04: se habilita smoke autenticado local no-productivo con bypass controlado (`AUTH_DEV_BYPASS_ENABLED` + prefijo) y comando reproducible `migration:smoke:runtime:auth` (PR23-A).
- 2026-03-04: se agrega paridad runtime `legacy vs v2` para booking read con comparación estructural normalizada (`migration:smoke:runtime:parity`) (PR23-B).
- 2026-03-04: runtime smoke/parity pasa a resolver `Host` usando `TENANT_BASE_DOMAIN` (fallback `*.localhost`) para alinear resolución tenant con runtime real.
- 2026-03-04: parity y auth smoke fijan contexto tenant explícito vía `x-local-id`/`x-tenant-subdomain` + `TENANT_ALLOW_HEADER_OVERRIDES=true`, elevando señal `2xx` en endpoints críticos (PR24-A).
- 2026-03-04: se crea gate opcional de release (`migration:gate:release`) que no bloquea por defecto y permite activación por entorno (`MIGRATION_RELEASE_GATE_ENABLED=true`) (PR24-B).
- 2026-03-04: el gate de release soporta umbrales explícitos (`MIGRATION_RELEASE_GATE_MIN_PASS_RATE`, `MIGRATION_RELEASE_GATE_MAX_FAILED_CHECKS`, `MIGRATION_RELEASE_GATE_CHECKS`) y modo enforce reproducible (`migration:gate:release:enforce`) (PR24-B).
- 2026-03-04: smoke autenticado evoluciona a write-path válido con resolución automática de slot real (`availability-batch`) y `create` 201 verificable (PR24-C).
- 2026-03-04: `checkout` en smoke autenticado pasa a payload válido y comportamiento condicional explícito (`SKIP` cuando Stripe no está disponible) para evitar falsos negativos operativos (PR24-C).
- 2026-03-04: release gate incorpora perfiles por entorno (`staging/canary/prod`) para estandarizar activación sin reescribir variables por pipeline (PR24-D).
- 2026-03-04: runbook de rollback del release gate queda formalizado (`MIGRATION_RELEASE_GATE_ENABLED=false` como bypass inmediato controlado) (PR24-D).
- 2026-03-04: `runtime-capability-smoke` migra de checks genéricos `400/no 5xx` a flujo tenant-aware con señal `2xx` real en `bootstrap/availability/create/payments` (PR24-E).
- 2026-03-04: runtime smoke incorpora resolución automática de slot y cleanup best-effort de citas para mantener repetibilidad sin drift de datos (PR24-E).
- 2026-03-04: runtime/auth smoke publican resumen estructurado estable (`[migration:smoke:summary]`) para habilitar reglas de gate basadas en cobertura de checkout (PR24-F).
- 2026-03-04: release gate endurece `canary/prod` con cobertura mínima no-skip en checkout (`MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT`, `MIGRATION_RELEASE_GATE_MIN_CHECKOUT_NON_SKIP`) (PR24-F).
- 2026-03-04: `roles` se migra como primer CRUD a `contexts/identity` con `use-cases + outbound port + prisma adapter`; `modules/roles` queda como adapter HTTP/Nest (PR25-A).
- 2026-03-04: `alerts` y `service-categories` migran a `contexts/engagement`/`contexts/commerce`; invariantes CRUD se mueven a application y `modules/*` quedan como adapters HTTP (PR25-B).
- 2026-03-04: adapters HTTP de CRUD migrados consolidan traducción de errores de dominio con helper compartido (`rethrowDomainErrorAsHttp`) para reducir duplicación y drift de comportamiento (PR25-C).
- 2026-03-04: `runtime-authenticated-smoke` incorpora capacidad CRUD real (`roles/alerts/service-categories`) y mantiene ejecución aunque checkout Stripe esté en `SKIP` (PR25-C).
- 2026-03-04: `product-categories` y `client-notes` migran a `contexts/commerce`/`contexts/engagement`; límites de notas y reglas de borrado de categorías quedan en application (PR25-D).
- 2026-03-04: `runtime-authenticated-smoke` extiende CRUD capability checks con `product-categories/client-notes` y explicita `SKIP` por ausencia de fixture cliente (PR25-E).
- 2026-03-04: `holidays` y `schedules` migran a `contexts/booking` con puertos de gestión (`HOLIDAY_MANAGEMENT_PORT`, `SCHEDULE_MANAGEMENT_PORT`) y adapters Prisma dedicados (PR26-A).
- 2026-03-04: `runtime-authenticated-smoke` incorpora capability checks de `holidays/schedules` (`general/barber` + `shop/barber`) con señal `PASS` end-to-end (PR26-B).
- 2026-03-05: inventario de bridges `contexts/* -> modules/*` pasa a soportar `--check` y `--require-zero-present` para enforcement reproducible en CI (PR35-B).
- 2026-03-05: `migration:gate:ci` se endurece para exigir también `migration:inventory:context-module-bridges:enforce-zero` junto a `arch:check` y `transition-artifacts` (PR35-B).
- 2026-03-05: `release-gate` ejecuta CI-guards previos (`arch`, `transition-artifacts`, `context-module-bridges`) cuando está habilitado, evitando correr smokes sobre un árbol con fronteras rotas (PR35-B).
- 2026-03-05: se formaliza ADR-0009 para enforcement post-migración (`contexts/*` sin imports a `modules/*`) y se actualizan README de ADR/bootstrap con guardrails operativos (PR35-C).
- 2026-03-05: booking elimina definitivamente modos transicionales `legacy/shadow`; `appointments.flags` queda fijo en `v2`, `appointments.facade` queda sin fallback legacy/shadow y `runtime-parity-smoke` pasa a `SKIP` explícito por retiro de modo legacy (PR35-D).
- 2026-03-05: `release-gate` perfila cierre de fase con `checks=runtime,auth` en `staging/canary/prod` (sin dependencia de parity legacy) y `migration:gate:release:staging` queda en verde con CI-guards activos (PR36-A).
- 2026-03-05: `runtime-preflight` incorpora reintentos de conectividad Prisma (`MIGRATION_PREFLIGHT_DB_RETRIES`/`MIGRATION_PREFLIGHT_DB_RETRY_DELAY_MS`) para reducir falsos negativos operativos (PR36-B).
- 2026-03-05: se habilita configuración Stripe operativa en tenant de smoke (`brand/local enabled + accountId`) para validar cobertura checkout no-skip en canary/prod (PR36-B).
- 2026-03-05: evidencia final cerrada: `migration:gate:release:canary` y `migration:gate:release:prod` en verde con `payments.checkout.valid=201` tanto en runtime como auth (PR36-B).
- 2026-03-05: Fase 9 se declara cerrada administrativamente con criterios DoD permanentes documentados (`arch/gate-ci/release-gate`) y roadmap pasa a línea de mantenimiento (`PR37-*`) (PR36-C).
- 2026-03-05: housekeeping post-migración: `runtime-parity-smoke` se simplifica a salida `SKIP` constante (sin preflight/build), se agrega baseline `migration:baseline:maintenance` y se limpian referencias obsoletas de `shadow-diff` en documentación (PR37-A).
- 2026-03-05: optimización de costes/tiempos en gates: scripts `*:fast` (sin repetir CI-guards tras `migration:gate:ci`) y bundle `migration:gate:release:canary-prod` para reutilizar un único `build+preflight` (PR37-B).
- 2026-03-05: se incorpora inventario automático de deuda residual post-migración (`migration:inventory:residual-debt`) con scoring por acoplamiento/LOC/Prisma/SDK para priorizar mantenimiento continuo sobre módulos `P0/P1` (PR37-C).
- 2026-03-05: `cash-register` se recorta al patrón target (`COMMERCE_CASH_REGISTER_MANAGEMENT_PORT` + use-cases + adapter Prisma), eliminando Prisma directo del módulo y bajando su prioridad residual de `P0` a `P3` tras regenerar inventario (PR38-A).
- 2026-03-05: `usage-metrics` se recorta al patrón target en dos capas (`contexts/platform` application + `modules/usage-metrics` adapter Prisma/TenantConfig), dejando `UsageMetricsService` como fachada sin Prisma y reduciendo prioridad residual de `P0` a `P3` (PR38-B).
- 2026-03-05: `runtime-authenticated-smoke` añade check de capacidad `auth.platform.metrics` (`GET /api/platform/metrics`) y marca `SKIP` cuando no existe actor `isPlatformAdmin`, evitando falsos negativos de entorno (PR38-C).
- 2026-03-05: evidencia operativa de PR38-C validada con `migration:smoke:runtime:auth` en verde, incluyendo `auth.platform.metrics: PASS [200]` y sin regresiones en capacidades previas (PR38-C).
- 2026-03-05: `observability` se recorta al patrón target (`PlatformObservabilityPort` + use cases en `contexts/platform` + adapter `in-memory/prisma`), dejando `ObservabilityService` como fachada sin Prisma y manteniendo API HTTP/interceptor sin cambios funcionales (PR38-D).
- 2026-03-05: `runtime-authenticated-smoke` incorpora capacidades `auth.platform.observability.web-vitals` y `auth.platform.observability.api` con `PASS [200]`; inventario residual actualizado baja `observability` de `P0` a `P3` (PR38-E).
- 2026-03-05: `platform-admin` se recorta al patrón target (`PlatformAdminManagementPort` + adapter Prisma/ImageKit + fachada `PlatformAdminService`), eliminando Prisma directo del service y bajando `platform-admin` de `P0` a `P3` en inventario residual (PR39-A).
- 2026-03-05: `runtime-authenticated-smoke` incorpora capacidades `auth.platform.brands.list` y `auth.platform.brand.health` con `PASS [200]`, cerrando regresión operativa mínima del vertical `platform-admin` (PR39-B).
- 2026-03-05: `subscriptions` se recorta al patrón target (`CommerceSubscriptionManagementPort` + adapter Prisma/Stripe + fachada `SubscriptionsService`), eliminando Prisma directo del service y bajando `subscriptions` de `P0` a `P3` en inventario residual (PR40-A).
- 2026-03-05: validación operativa del vertical `subscriptions` cerrada con `build`, `arch:check`, tests (`subscriptions-management.facade`, `commerce-subscription-policy.adapter`) y `migration:smoke:runtime:auth` en verde (`auth.subscriptions.me`, `auth.subscriptions.me.active`, `auth.admin.subscriptions.plans` = `PASS [200]`) (PR40-B).
- 2026-03-05: `notifications` se recorta al patrón target (`EngagementNotificationManagementPort` + adapter settings/tenant/twilio/email + fachada `NotificationsService`), eliminando acoplamiento directo del service a infra y bajando su prioridad residual de `P0` a `P1` en inventario (PR41-A).
- 2026-03-05: validación operativa del vertical `notifications` cerrada con `build`, `arch:check`, tests (`notifications-management.facade`, adapters nodemailer/twilio) y `migration:smoke:runtime:auth` en verde con checks nuevos `auth.admin.notifications.test-sms|test-whatsapp` (`PASS [400]` esperado por payload inválido) (PR41-B).
- 2026-03-05: `loyalty` se recorta al patrón target (`CommerceLoyaltyManagementPort` + adapter Prisma/subscription-policy + fachada `LoyaltyService`), eliminando Prisma directo del service y bajando `loyalty` de `P0` a `P3` en inventario residual (PR42-A).
- 2026-03-05: validación operativa del vertical `loyalty` cerrada con `build`, `arch:check`, tests (`loyalty-management.facade`, `commerce-loyalty-progress-policy`) y `migration:smoke:runtime:auth` en verde con checks nuevos `auth.loyalty.programs.active` y `auth.admin.loyalty.programs` (`PASS [200]`) (PR42-B).
- 2026-03-05: `referral-attribution` se recorta al patrón target dentro de `referrals` (`EngagementReferralAttributionManagementPort` + adapter Prisma/config/rewards/notifications + fachada `ReferralAttributionService`), manteniendo contratos públicos/admin y compatibilidad con tests de anti-fraude/rewarding (PR43-A).
- 2026-03-05: validación operativa de `referrals` fase 1 cerrada con `build`, `arch:check`, tests (`referral-anti-fraud`, `referral-rewarding`, `referral-attribution-management.facade`) y `migration:smoke:runtime:auth` en verde con nuevo check `auth.admin.referrals.list` (`PASS [200]`) (PR43-B).
- 2026-03-05: `referral-config` y `rewards` se recortan al patrón target dentro de `referrals` (`EngagementReferralConfigManagementPort` + `EngagementReferralRewardManagementPort`), moviendo la lógica Prisma a adapters dedicados y dejando `ReferralConfigService`/`RewardsService` como facades delgadas (PR44-A).
- 2026-03-05: validación operativa de `referrals` fase 2 cerrada con `build`, `arch:check`, tests de adapters/facades (`referral-rewards`, `referral-config-management.facade`, `referral-reward-management.facade`) y `migration:smoke:runtime:auth` en verde con nuevo check `auth.admin.referrals.config` (`PASS [200]`); inventario residual actualizado (`P0=2`, `referrals` baja a `P1`) (PR44-B).
- 2026-03-05: `ai-assistant` mueve políticas de intención/sanitización/fallback a `contexts/ai-orchestration/domain` (`assistant-intent-policy`, `assistant-response-policy`, tipos compartidos), reduciendo lógica embebida en `AiAssistantService` sin cambiar contratos HTTP (PR45-A1).
- 2026-03-05: validación operativa de `PR45-A1` cerrada con `build`, `arch:check`, tests de IA (`ai-assistant-utils`, `ai-tools-registry`, `ai-assistant-policies.domain`) y `migration:smoke:runtime:auth` en verde; inventario residual mantiene `P0=2` pero reduce LOC de `ai-assistant` (980 -> 759) (PR45-A1).
- 2026-03-05: `ai-assistant` extrae orquestación principal (`chat/get-session/transcribe`) a `contexts/ai-orchestration/application` con puertos explícitos (`AI_ASSISTANT_MEMORY_PORT`, `AI_ASSISTANT_TOOLS_PORT`, `AI_TENANT_CONFIG_PORT`, `AI_LLM_PORT`, `AI_USAGE_METRICS_PORT`) y adapters dedicados; `AiAssistantService` queda como fachada/adaptador HTTP (PR45-A2).
- 2026-03-05: validación operativa de `PR45-A2/PR45-B` cerrada con `build`, `arch:check`, tests de IA incluyendo `ai-assistant.usecases`, `migration:smoke:runtime:auth`, `migration:gate:ci` y actualización de inventario residual (`P0=1`; `ai-assistant` baja de `P0` a `P1`, score 14->10, LOC 980->393) (PR45-B).
- 2026-03-05: `appointments` read path migra `findOne` a `FindAppointmentByIdUseCase` con sync de estado previo vía `BookingMaintenancePort`, y `AppointmentsFacade.anonymize` deja de delegar directo al service legacy para usar `AnonymizeAppointmentUseCase` (PR46-A2).
- 2026-03-05: validación operativa de `PR46-A2` cerrada con `build`, `arch:check`, tests booking (`booking-appointment-query`, `booking-anonymize-appointment`, `booking-sync-appointment-statuses`, `booking-get-availability`, `booking-update-appointment`, `booking-remove-appointment`) + `migration:smoke:runtime:auth` + `migration:gate:ci`; inventario residual mantiene `P0=1` pero reduce LOC de `appointments` (`2069 -> 1920`) (PR46-A2).
- 2026-03-05: `appointments` migra `dashboard-summary` a `contexts/booking` con `GetBookingDashboardSummaryUseCase` + `BookingDashboardReadPort` + `booking-dashboard-summary.policy` (dominio), manteniendo contrato HTTP sin cambios y reduciendo lógica residual en `AppointmentsService` (PR46-A3).
- 2026-03-05: validación operativa de `PR46-A3` cerrada con `build`, `arch:check`, tests booking (incluyendo `booking-dashboard-summary.usecase`) + `migration:smoke:runtime:auth` + `migration:gate:ci`; inventario residual mantiene `P0=1` y reduce LOC de `appointments` (`1920 -> 1662`) (PR46-A3).
- 2026-03-05: `appointments` extrae write `remove` desde `AppointmentsService` hacia `ModuleBookingCommandAdapter` (Prisma + side-effects via `RunAppointmentStatusSideEffectsUseCase` + audit logs), preservando contrato del `BookingCommandPort` y comportamiento transaccional (PR46-A4a).
- 2026-03-05: validación operativa de `PR46-A4a` cerrada con `build`, `arch:check`, tests (`appointments-booking-command.adapter`, `booking-remove/update/create`, `booking-dashboard-summary`, `booking-appointment-query`) + `migration:smoke:runtime:auth` + `migration:gate:ci`; inventario residual mantiene `P0=1` y reduce LOC de `appointments` (`1662 -> 1633`) (PR46-A4a).
- 2026-03-05: `appointments` extrae maintenance write (`anonymize`, `syncStatusesForAllAppointments`, `syncStatusesForAppointments`) desde `AppointmentsService` hacia `ModuleBookingMaintenanceAdapter` (Prisma + side-effects + audit), manteniendo contratos de `BookingMaintenancePort` para jobs y `findOne` sync previo (PR46-A4b).
- 2026-03-05: validación operativa de `PR46-A4b` cerrada con `build`, `arch:check`, tests (`appointments-booking-maintenance.adapter`, `appointments-booking-command.adapter`, `booking-anonymize/sync/remove/update/create`, `booking-dashboard-summary`, `booking-appointment-query`) + `migration:smoke:runtime:auth` + `migration:gate:ci`; inventario residual mantiene `P0=1` y reduce LOC de `appointments` (`1633 -> 1529`) (PR46-A4b).
- 2026-03-05: `appointments.facade` elimina fallbacks legacy para `availability-batch` y `weekly-load` (ahora resueltos solo por use cases); `AppointmentsService` elimina métodos legacy redundantes (`getAvailableSlotsBatch`, `getWeeklyLoad`) sin cambio de contrato HTTP (PR46-A4c).
- 2026-03-05: validación operativa de `PR46-A4c` cerrada con `build`, `arch:check`, tests (`ai-legacy-tool-adapters`, booking adapters/use-cases) + `migration:smoke:runtime:auth` + `migration:gate:ci`; inventario residual mantiene `P0=1` y reduce LOC de `appointments` (`1529 -> 1355`) (PR46-A4c).
- 2026-03-05: `sendPaymentConfirmation` sale de `AppointmentsService` hacia `SendAppointmentPaymentConfirmationUseCase` (booking/application) + `ModuleBookingMaintenanceAdapter` (Prisma + Notifications), manteniendo contratos de `AppointmentsFacade` usados por `payments` (PR46-A4d).
- 2026-03-05: validación operativa de `PR46-A4d` cerrada con `build`, `arch:check`, tests (`booking-send-payment-confirmation.usecase`, `appointments-booking-maintenance.adapter`, `ai-legacy-tool-adapters`, booking adapters/use-cases) + `migration:smoke:runtime:auth` + `migration:gate:ci`; inventario residual mantiene `P0=1` y reduce LOC de `appointments` (`1355 -> 1345`) (PR46-A4d).
- 2026-03-05: se extraen reglas puras de `update` a dominio (`update-appointment-policy`: transición de estado, timing completion, cutoff cancelación, permisos admin) y `AppointmentsService.update` pasa a consumir la policy con excepciones HTTP en capa de aplicación/adaptador (PR46-A4e).
- 2026-03-05: `AppointmentsFacade` elimina dependencia residual de `AppointmentsService` y queda como entrypoint puramente orientado a use cases/ports; validación operativa de `PR46-A4e` cerrada con `build`, `arch:check`, tests de dominio+booking+adapters + `migration:smoke:runtime:auth` + `migration:gate:ci` (PR46-A4e).
- 2026-03-05: `AppointmentsService` elimina el engine legacy de availability no usado (`computeAvailableSlotsForBarber`, `resolveEndOverflow*`, `getAvailableSlots`), manteniendo `assertSlotAvailable` enrutado a `GetAvailabilityUseCase` y limpiando dependencias legacy (`HolidaysService`, `schedule.utils`, `schedule.types`) (PR46-A4f1).
- 2026-03-05: validación operativa de `PR46-A4f1` cerrada con `build`, `npm test -- --runInBand` (214 tests en verde) y regeneración de inventario residual (`appointments` baja a score `14` y LOC `1094`) (PR46-A4f1).
- 2026-03-05: `updateAppointment` migra de `AppointmentsService` a `ModuleBookingCommandAdapter` (booking command port) con orquestación completa de pricing/loyalty/subscription, validaciones, ajuste de stock, transacción `SERIALIZABLE`, side-effects de estado y notificación; `AppointmentsService` elimina método `update` legacy (PR46-A4f2).
- 2026-03-05: validación operativa de `PR46-A4f2` cerrada con `build`, `npm test -- --runInBand` (215 tests en verde), `arch:check`, `migration:gate:ci`, `migration:smoke:runtime:auth` y regeneración de inventario residual (`appointments` baja a `LOC 743`, mantiene `P0`) (PR46-A4f2).
- 2026-03-05: `createAppointment` migra de `AppointmentsService` a `ModuleBookingCommandAdapter`; se elimina `AppointmentsService` del runtime (`appointments.module` deja de exportarlo/proveerlo) y cobertura de consentimiento/create se mueve a tests del adapter (`appointments-booking-command.adapter.test`) (PR46-A4f3).
- 2026-03-05: `appointments-retention.service` deja de usar `PrismaService` directo y consulta candidatos de anonimización via `BookingMaintenancePort`; inventario residual actualizado queda sin módulos `P0` (`P0=0`, `appointments` pasa a `P3`) con validación completa (`build`, `npm test -- --runInBand`, `arch:check`, `migration:gate:ci`, `migration:smoke:runtime:auth`) (PR46-B).
- 2026-03-05: `payments` extrae transiciones webhook y política de cancelación a `contexts/commerce/application` (`ProcessStripeWebhookUseCase`) con `COMMERCE_PAYMENT_LIFECYCLE_PORT` + adapter Prisma (`PrismaPaymentLifecycleAdapter`), incluyendo cancelación de pagos expirados por local y manteniendo contratos HTTP/Stripe sin cambios (PR47-A).
- 2026-03-05: validación operativa de `PR47-A` cerrada con `build`, `npm test -- --runInBand` (`221 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`payments` sigue `P1` con `LOC 493`; pendiente recorte `PR47-C` sobre checkout/config Stripe) (PR47-A).
- 2026-03-06: `runtime-authenticated-smoke` amplía checks de `payments` post-recorte (`auth.payments.availability`, `auth.admin.payments.stripe.config`, `auth.payments.webhook.invalid-body`) para reforzar cobertura capability/auth del vertical (PR47-B1).
- 2026-03-06: validación local de `PR47-B1` cerrada con `build`, `npm test -- --runInBand` (`221 tests`) y `migration:gate:ci`; `migration:smoke:runtime:auth` permanece bloqueado en este entorno por `runtime-preflight` DB (`127.0.0.1:3306`) y queda pendiente en entorno operativo (PR47-B).
- 2026-03-06: `payments` extrae checkout/configuración Stripe a `contexts/commerce/application` (`ManageOnlinePaymentsUseCase`) + `COMMERCE_PAYMENT_MANAGEMENT_PORT`; nuevo adapter `PrismaStripePaymentManagementAdapter` encapsula Prisma/TenantConfig/AppointmentsFacade/Stripe y `PaymentsService` queda como fachada delgada + webhook/status jobs (PR47-C).
- 2026-03-06: validación operativa de `PR47-C` cerrada con `build`, `npm test -- --runInBand` (`222 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`payments` baja de `P1` a `P3`, `LOC 493 -> 154`, `Prisma yes -> no`) (PR47-C).
- 2026-03-06: `reviews` migra a arquitectura target en `engagement` con `ENGAGEMENT_REVIEW_MANAGEMENT_PORT` + `ManageReviewsUseCase` + `PrismaReviewManagementAdapter`; `ReviewRequestService`, `ReviewConfigService` y `ReviewAnalyticsService` pasan a fachadas sin Prisma directo (PR48-A).
- 2026-03-06: validación operativa de `PR48-A` cerrada con `build`, `npm test -- --runInBand` (`225 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`reviews` baja de `P1` a `P3`, `LOC 601 -> 126`, `Prisma yes -> no`, módulos Prisma directos `9 -> 8`) (PR48-A).
- 2026-03-06: `runtime-authenticated-smoke` amplía capacidades de `reviews` (`auth.reviews.pending`, `auth.admin.reviews.config`, `auth.admin.reviews.metrics`) para cobertura operacional del vertical migrado (PR48-B).
- 2026-03-06: validación local de `PR48-B` cerrada (`node --check` + `build` + `test` + `gate:ci`); `migration:smoke:runtime:auth` sigue bloqueado por `runtime-preflight` DB (`127.0.0.1:3306`) en este entorno y queda pendiente en entorno operativo (PR48-B).
- 2026-03-06: `referrals` recorta Prisma directo residual en services (`ReferralTemplatesService`, `ReferralCodeService`, `ReferralsSchedulerService`) con puertos/use-cases/adapters nuevos (`ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT`, `ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT`, `ENGAGEMENT_REFERRAL_MAINTENANCE_PORT`) y mantiene contratos HTTP/jobs sin cambios (PR49-A).
- 2026-03-06: validación local de `PR49-A` cerrada con `build`, `npm test -- --runInBand` (`230 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`referrals` baja de `P1` a `P3`, `Prisma yes -> no`, módulos Prisma directos `8 -> 7`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR49-B` en entorno operativo.
- 2026-03-07: `legal` migra a arquitectura target en `platform` con `PLATFORM_LEGAL_MANAGEMENT_PORT` + `ManageLegalSettingsUseCase` + `PrismaPlatformLegalManagementAdapter`; `LegalService` pasa a fachada sin Prisma directo y se preservan endpoints públicos/platform y flujos de consentimiento usados por booking (PR50-A).
- 2026-03-07: validación local de `PR50-A` cerrada con `build`, `npm test -- --runInBand` (`232 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`legal` baja de `P1` a `P3`, módulos Prisma directos `7 -> 6`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR50-B` en entorno operativo.
- 2026-03-07: `ai-assistant` migra persistencia de memoria y mantenimiento diario a adapters Prisma en `contexts/ai-orchestration` (`PrismaAiAssistantMemoryAdapter`, `PrismaAiAssistantMemoryMaintenanceAdapter`) con puertos explícitos (`AI_ASSISTANT_MEMORY_PORT`, `AI_ASSISTANT_MEMORY_MAINTENANCE_PORT`), retirando `AiMemoryService` y bridge legacy de memoria del módulo (PR51-A).
- 2026-03-07: validación local de `PR51-A` cerrada con `build`, `npm test -- --runInBand` (`232 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`ai-assistant` baja de `P1` a `P3`, módulos Prisma directos `6 -> 5`, `service files 40 -> 39`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR51-B` en entorno operativo.
- 2026-03-07: `barbers` elimina Prisma directo de `BarbersService` y centraliza compatibilidad de servicio en `BARBER_ELIGIBILITY_READ_PORT` (`PrismaBarberEligibilityReadAdapter`), manteniendo reglas de negocio (`assertBarberCanProvideService`) y contratos HTTP sin cambios (PR52-A).
- 2026-03-07: validación local de `PR52-A` cerrada con `build`, `npm test -- --runInBand` (`235 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`barbers` baja de `P1` a `P3`, módulos Prisma directos `5 -> 4`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR52-B` en entorno operativo.
- 2026-03-07: `settings` migra a arquitectura target en `platform` con `PLATFORM_SETTINGS_MANAGEMENT_PORT` + `ManagePlatformSettingsUseCase` + `PrismaPlatformSettingsManagementAdapter`; `SettingsService` queda como fachada y se mantiene el contrato de `SiteSettings` consumido por módulos de booking/commerce/engagement (PR53-A).
- 2026-03-07: validación local de `PR53-A` cerrada con `build`, `npm test -- --runInBand` (`237 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`settings` baja de `P1` a `P3`, módulos Prisma directos `4 -> 3`); pendiente evidencia runtime/auth en entorno operativo (PR53-B).
- 2026-03-07: `imagekit` migra a arquitectura target en `platform` con `PLATFORM_MEDIA_MANAGEMENT_PORT` + `ManagePlatformMediaUseCase` + `PrismaPlatformImageKitManagementAdapter`; `ImageKitService` queda como fachada y se mantiene compatibilidad con `platform-admin`, `barbers` y `products` para firma/borrado de archivos (PR54-A).
- 2026-03-07: validación local de `PR54-A` cerrada con `build`, `npm test -- --runInBand` (`241 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`imagekit` baja de `P1` a `P3`, módulos Prisma directos `3 -> 2`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR54-B` en entorno operativo.
- 2026-03-07: `notifications/reminders` extrae lectura/marcado de recordatorios a `ENGAGEMENT_NOTIFICATION_REMINDER_PORT` con adapter Prisma (`PrismaEngagementNotificationReminderAdapter`) y mueve la orquestación de envío a `RunNotificationRemindersUseCase`; `RemindersService` queda como scheduler + lock + iterador sin Prisma directo (PR55-A).
- 2026-03-07: validación local de `PR55-A` cerrada con `build`, `npm test -- --runInBand` (`244 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`notifications` baja de `P1` a `P3`, módulos Prisma directos `2 -> 1`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR55-B` en entorno operativo.
- 2026-03-07: `audit-logs` migra a arquitectura target en `platform` con `PLATFORM_AUDIT_LOG_MANAGEMENT_PORT` + `ManagePlatformAuditLogsUseCase` + `PrismaPlatformAuditLogManagementAdapter`; `AuditLogsService` queda como fachada y se mantienen contratos de `log/list` consumidos por `appointments`, `legal` y `platform-admin` (PR56-A).
- 2026-03-07: validación local de `PR56-A` cerrada con `build`, `npm test -- --runInBand` (`246 tests`), `arch:check`, `migration:gate:ci` e inventario residual regenerado (`audit-logs` baja de `P1` a `P3`, módulos Prisma directos `1 -> 0`, `P0/P1=0`); intento de `migration:smoke:runtime:auth` bloqueado por `runtime-preflight` (`PORT 3000` en uso + MySQL inaccesible en `127.0.0.1:3306`), queda pendiente `PR56-B` en entorno operativo.
- 2026-03-07: hardening `PR57-A` ejecutado localmente con release gates `staging:fast`, `canary:fast` y `prod:fast`; todos fallan por dependencia de runtime/DB (`Can't reach database server at 127.0.0.1:3306`) y cobertura checkout no evaluable sin smoke operativo.
- 2026-03-07: el cierre final queda condicionado a entorno operativo (`DB + runtime auth`) para completar `migration:smoke:runtime:auth` y `migration:gate:release:*` fuera del sandbox local (PR57-B).
- 2026-03-07: campaña de cierre `P3` pendiente completada con puertos compartidos `TENANT_CONFIG_READ_PORT` y `DISTRIBUTED_LOCK_PORT` (`tenancy/prisma` adapters), migrando `barbers`, `firebase`, `notifications/reminders`, `ai-memory-cleanup`, `appointments-status-sync` y `appointments-retention` para eliminar imports `*.service/*.utils` cruzados en services de módulo (PR57-C).
- 2026-03-07: inventario residual regenerado tras `PR57-C` con backlog real pendiente en cero (`Pending backlog: total=0, P0=0, P1=0, P2=0, P3=0`), validado con `build`, `npm test -- --runInBand`, `arch:check` y `migration:gate:ci`; queda únicamente evidencia runtime/release en entorno operativo (PR57-B).
- 2026-03-07: se corrige wiring runtime exportando `PLATFORM_LEGAL_MANAGEMENT_PORT` desde `LegalModule`, desbloqueando bootstrap para `AppointmentsRetentionService` en entorno operativo (PR57-B).
- 2026-03-07: evidencia operativa final cerrada en entorno con DB/runtime activos: `migration:smoke:runtime:auth` en verde y release gates `migration:gate:release:staging:fast`, `migration:gate:release:canary:fast`, `migration:gate:release:prod:fast` en verde (PR57-B).
- 2026-03-07: se incorpora auditoría de salud backend en `docs/analytics/BACKEND_HEALTH_AUDIT.md` con baseline real (tests, gates, tamaño artefactos), checklist obligatorio, umbrales de degradación y plantilla histórica para comparativa periódica (PR58-A).
