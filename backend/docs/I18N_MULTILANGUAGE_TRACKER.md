# I18N Multi-language Tracker

## Objetivo
Implementar soporte multiidioma tenant-aware con traducción persistida, fallback robusto, edición manual controlada y selector de idioma en frontend.

## Estado global
- Fase actual: `Fase 9 - Observabilidad i18n cross-tenant en Platform (cerrada)`
- Última actualización: `2026-03-09 (panel global i18n + acciones pausa/reanudación por tenant)`

## Plan por fases

### Fase 1 - Fundaciones de dominio y datos
- [x] Definir política i18n en config tenant (`defaultLanguage`, `supportedLanguages`, `autoTranslate`).
- [x] Extender tipos de `TenantConfig` backend/frontend para i18n.
- [x] Añadir modelos Prisma para contenido localizado y traducciones persistidas.
- [x] Añadir estado/versionado/origen (`pending/ready/failed/stale`, `ai/manual`, `manualLocked`).

### Fase 2 - Pipeline de localización y fallback
- [x] Crear módulo `localization` backend.
- [x] Resolver idioma efectivo por request (`x-app-language`, `Accept-Language`, fallback tenant default).
- [x] Sincronizar texto fuente al crear/editar entidades traducibles.
- [x] Aplicar localización en lecturas con fallback al texto base.
- [x] Generar traducciones asíncronas con job cron + lock distribuido.
- [x] Exponer endpoints admin para edición manual y regeneración controlada.

### Fase 3 - Integración de producto
- [x] Integrar i18n en Platform con UI para idioma principal + idiomas habilitados + auto-traducción.
- [x] Añadir selector moderno de idioma en footer de landing.
- [x] Añadir selector en `Mi perfil` para persistencia preferida por usuario en storage.
- [x] Propagar idioma activo en todas las requests API (`x-app-language`).

### Fase 4 - Stabilization y quality gates
- [x] Ejecutar `prisma generate` y validar schema/migración SQL.
- [x] Ejecutar tests/lint/typecheck y corregir regresiones.
- [x] Documentar completamente la feature en `docs/ARCHITECTURE.md`.

### Fase 5 - Frontend i18n de textos fijos
- [x] Crear capa frontend i18n (`messages`, `translateUi`, `useI18n`).
- [x] Separar catálogo UI en JSON por idioma (`frontend/src/i18n/locales/es.json`, `frontend/src/i18n/locales/en.json`).
- [x] Aplicar traducción en rutas públicas principales (`Landing`, `Auth`, `HoursLocation`) y `Navbar`.
- [x] Aplicar traducción base en `Profile` (toasts + secciones principales).
- [x] Extender cobertura al flujo cliente restante (`ClientDashboard`, `Appointments`, `Subscriptions`, `Referrals`, `BookingWizard`) + componentes compartidos cliente (`ClientLayout`, `ProductSelector`, `LoyaltyProgressPanel`, `AppointmentEditorDialog`).
- [x] Extender cobertura core a admin tenant (`AdminSidebar` + `Dashboard/Calendar/Search/Clients/Settings` en títulos, acciones, toasts y flujos críticos) y hard-lock de Platform a español.
- [x] Añadir guardrail automático de cobertura i18n frontend (`npm --prefix frontend run i18n:check`) para claves usadas en runtime y paridad de placeholders `es/en`.

### Fase 6 - Endurecimiento QA i18n
- [x] Añadir smoke tests frontend para idioma tenant (`LanguageProvider` lock platform `es`, restauración de preferencia por usuario, visibilidad selector).
- [x] Añadir script dedicado `npm --prefix frontend run test:smoke:i18n`.
- [x] Corregir hardcodes residuales detectados (`AdminPermissionsContext` toast de carga de roles).
- [x] Crear checklist de revisión de copy para iteraciones futuras (`docs/FRONTEND_I18N_COPY_CHECKLIST.md`).

### Fase 7 - UI control traducciones dinámicas
- [x] Exponer cliente API frontend para localización (`GET entity`, `PATCH manual`, `POST regenerate`).
- [x] Exponer resumen backend por lotes (`GET /localization/summary/:entityType?ids=...`) para pintar estado en listas sin abrir diálogo.
- [x] Crear diálogo reusable de gestión de traducciones con:
  - estados visibles (`pending/ready/failed/stale/missing`),
  - edición manual por idioma,
  - bloqueo manual (`manualLocked`),
  - regeneración por idioma/campo/entidad.
- [x] Integrar UI en módulos admin con contenido dinámico:
  - `AdminServices` (`service`, `service_category`),
  - `AdminStock` (`product`, `product_category`),
  - `AdminAlerts` (`alert`),
  - `AdminSettings` (`site_settings` campos sincronizados),
  - `AdminOffers` (`offer`),
  - `AdminLoyalty` (`loyalty_program`),
  - `AdminSubscriptions` (`subscription_plan`),
  - `AdminBarbers` (`barber`),
  - `AdminReviews` (`review_config` campos `copyJson.*`).
- [x] Añadir copy i18n `es/en` para el manager (`admin.localization.*`).
- [x] Mostrar badges de estado en cards/listados (`LocalizationStatusBadge`) en módulos integrados.
- [x] Validar en verde: `i18n:check`, `lint`, `test:smoke:i18n`, `build`, `backend localization unit`.
- [x] Simplificar UX en `AdminServices` con patrón inline por input (`name`, `description`) y popover compacto por campo.

### Fase 8 - Gobierno i18n enterprise en Platform
- [x] Mover todo el bloque de idiomas fuera de `Config` a una pestaña dedicada `Idiomas` por tenant.
- [x] Dejar `Config` sin controles i18n (sin estado transitorio ni duplicado).
- [x] Ampliar controles `autoTranslate` con operación enterprise:
  - pausa manual (`paused`, `pauseUntil`, `pauseReason`),
  - límites de negocio (`monthlyRequestLimit`, `monthlyCharacterLimit`),
  - resiliencia (`retryAttempts`),
  - seguridad operativa (`circuitBreaker`: umbral, muestras mínimas, fallos consecutivos, ventana y pausa automática).
- [x] Endurecer normalización/sanitización de config tenant para persistir y validar estos campos en backend.
- [x] Aplicar enforcement en runtime del pipeline de localización:
  - respeta pausa manual/temporal,
  - aplica cuotas mensuales,
  - reintentos controlados,
  - activación automática de pausa por circuit breaker ante degradación.
- [x] Validar en verde build/lint/smokes tras mover UI y endurecer backend.

### Fase 9 - Observabilidad i18n cross-tenant
- [x] Exponer resumen global i18n en backend para Platform (`GET /platform/observability/i18n?minutes=...`) con:
  - cola pendiente por tenant,
  - fallo en ventana (`ready/failed`, ratio, umbral),
  - consumo mensual (`requests`, `characters`) y límites por tenant,
  - estado operativo (`ok/warning/critical/paused`).
- [x] Exponer acciones operativas por tenant en backend:
  - `POST /platform/observability/i18n/:brandId/pause`,
  - `POST /platform/observability/i18n/:brandId/resume`.
- [x] Añadir UI en `PlatformObservability` para lectura rápida y control:
  - KPIs globales (`críticos`, `pausados`, `cola total`, `cerca de límite`, `fallo alto`),
  - tabla compacta por tenant con estado + cola + fallos + uso mensual,
  - switch `Solo alertas`,
  - botón inline `Pausar/Reanudar` por tenant.
- [x] Añadir cobertura unitaria backend para agregación y acción de pausa/reanudación (`platform-i18n-observability.service.test.ts`).
- [x] Validar en verde: backend build + unit tests, frontend lint/build + smoke + i18n check.

## Último punto completado
- Iteración de observabilidad i18n cross-tenant (enterprise):
  - servicio backend `PlatformI18nObservabilityService` con agregación global por `brandId` (cola, fallos ventana, límites/uso mensual, estado operativo),
  - endpoints Platform para resumen y acción rápida de pausa/reanudación por tenant,
  - nueva sección en `PlatformObservability` con diseño compacto y operativo (KPIs + tabla + acciones inline),
  - clientes API frontend y tipos dedicados para el panel,
  - tests unitarios backend añadidos para agregación y transición `paused -> resumed`.
  - mejora UX de comprensión:
    - tooltips añadidos en card `I18N Operativa` de Platform Observability (toggle `Solo alertas`, KPIs y cabeceras clave de tabla).
  - validación ejecutada: `npm --prefix backend run build`, `npm --prefix backend run test:unit -- test/unit/platform/platform-i18n-observability.service.test.ts`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend run i18n:check`, `npm --prefix frontend run test:smoke:i18n`.
- Iteración de control de traducciones dinámicas en admin:
  - componente reusable `frontend/src/components/admin/LocalizationManagerDialog.tsx`,
  - componente de estado en lista `frontend/src/components/admin/LocalizationStatusBadge.tsx`,
  - API frontend `frontend/src/data/api/localization.ts` + tipos `LocalizedEntityField/Translation`,
  - endpoint backend de resumen por lote en `LocalizationController/LocalizationService`,
  - integración en `AdminServices`, `AdminStock`, `AdminAlerts`, `AdminSettings`,
  - acciones de UI: guardar manual, bloquear manual, regenerar idioma, regenerar todo, refrescar estados,
  - visibilidad inmediata en listas por badge (ready/pending/failed/stale/missing),
  - soporte de fallback visual cuando aún no existe traducción (`missing`),
  - claves i18n nuevas `admin.localization.*` en `es/en`.
- Validación en verde: `npm --prefix frontend run i18n:check`, `npm --prefix frontend run lint`, `npm --prefix frontend run test:smoke:i18n`, `npm --prefix frontend run build`, `backend test/unit/platform/localization.service.test.ts`.
- Iteración de simplificación UX (Admin Services):
  - se retira la interacción pesada en tarjetas de `AdminServices` (sin badges/botones extra por card),
  - se añade patrón inline por campo traducible (`name`, `description`) con icono discreto,
  - click en icono abre popover compacto con: idioma, estado, texto editable, botón `Generar` y botón `Guardar`,
  - soporte para `service` y `service_category` directamente dentro de los formularios de alta/edición.
  - ajuste UX/estado tras pruebas reales:
    - selector inline muestra todos los idiomas soportados (incluido fuente con etiqueta),
    - selección de idioma fuente en modo solo lectura (edición en input principal),
    - refresco automático cada 2s con popover abierto para que `pending -> ready/failed` se actualice sin recargar página.
    - visibilidad del icono inline:
      - no se muestra en formularios de creación (solo edición de entidad existente),
      - no se muestra cuando el tenant tiene un único idioma habilitado.
  - migración en bloque del patrón inline por input en admin (sin diálogo pesado):
    - `AdminServices`: `service` + `service_category` (`name`, `description`),
    - `AdminStock`: `product` + `product_category` (`name`, `description`),
    - `AdminAlerts`: `alert` (`title`, `message`),
    - `AdminSettings`: `site_settings` (`branding.tagline`, `branding.description`, `location.label`),
    - `AdminOffers`: `offer` (`name`, `description`),
    - `AdminLoyalty`: `loyalty_program` (`name`, `description`),
    - `AdminSubscriptions`: `subscription_plan` (`name`, `description`),
    - `AdminBarbers`: `barber` (`name`, `specialty`, `bio`),
    - `AdminReviews`: `review_config` (`copyJson.title`, `copyJson.subtitle`, `copyJson.positiveText`, `copyJson.negativeText`).
  - extensión backend de entidades localizables:
    - lectura localizada + sync de fuente en `offers`, `loyalty`, `subscriptions`, `barbers`, `reviews`,
    - soporte API `LocalizationController` y DTOs ampliado para `offer`, `loyalty_program`, `subscription_plan`, `barber`, `review_config`.
  - regla de implementación establecida:
    - todo input de texto editable de admin (no numérico) con soporte de localización debe incluir control inline por campo,
    - si el tenant tiene 1 idioma, el control no se renderiza,
    - en creación no se renderiza; solo en edición de entidad persistida.
  - regla de copy fijo frontend:
    - cualquier texto fijo de UI fuera de Platform debe vivir en `frontend/src/i18n/locales/*.json` y consumirse vía `useI18n`.
  - ajuste de prioridad/persistencia de idioma tenant:
    - `LanguageProvider` ya no persiste automáticamente el idioma resuelto en bootstrap,
    - solo se guarda en storage cuando el usuario lo cambia explícitamente (selector/footer/perfil),
    - al cambiar `defaultLanguage` en Platform, admin/clientes sin preferencia guardada adoptan el nuevo default al recargar.
  - ajuste backend de consistencia de fuente (`sourceLanguage`):
    - `GET /localization/entity/:entityType/:entityId` realinea filas legacy con `sourceLanguage` distinto al `defaultLanguage` vigente del tenant,
    - al realinear: incrementa versión fuente, marca destinos no bloqueados en `pending`, bloqueados en `stale`, elimina fila residual del nuevo idioma fuente y garantiza filas faltantes para idiomas objetivo.
  - validación ejecutada: `npm --prefix frontend run i18n:check`, `npm --prefix frontend run lint`, `npm --prefix frontend run test:smoke:i18n`.
  - validación ejecutada (iteración completa): `npm --prefix frontend run lint`, `npm --prefix frontend run i18n:check`, `npm --prefix frontend run test:smoke:i18n`, `npm --prefix backend run build`, `npm --prefix backend run test:unit -- test/unit/platform/localization.service.test.ts`.
- Iteración enterprise de gobierno i18n en Platform:
  - se crea pestaña dedicada `Idiomas` por tenant en `PlatformBrands` con controles de:
    - idioma principal + idiomas habilitados,
    - auto-traducción,
    - límites de peticiones/caracteres,
    - reintentos,
    - circuit breaker,
    - pausa manual y pausa hasta fecha.
  - se elimina por completo la sección de idiomas de la pestaña `Config` (sin duplicidad/transitorio).
  - backend refuerza tipos/defaults/sanitización y enforcement operativo en `LocalizationService`.
  - validación ejecutada: `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend run i18n:check`, `npm --prefix frontend run test:smoke:i18n`, `npm --prefix backend run build`.

## Siguiente tarea inmediata
- Ninguna bloqueante para este bloque: fase de control i18n enterprise cerrada.
