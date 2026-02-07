# ARCHITECTURE - Managgio

## Vision general de producto
Managgio es una plataforma multi-tenant para gestionar negocios que funcionan con citas (barberias, peluquerias, centros de estetica, etc). El sistema se divide en:
- **Platform Admin (Managgio)**: panel central para crear marcas (brands), locales (locations) y configurar credenciales/estilo por marca o por local.
- **Panel del cliente (por subdominio)**: la plataforma del cliente se identifica por subdominio o dominio custom; incluye landing, sistema de citas, gestion de festivos/alertas/horarios, configuracion personalizada y asistente con chat y audio.

Objetivo UX/Producto (reglas de oro):
- UI siempre atractiva, intuitiva, moderna, ligera y 100% responsive.
- Experiencia profesional a nivel empresa grande.
- Codigo modular, compartimentado y escalable (componentes y servicios reutilizables).
- No dar nada por sentado: cubrir casos limite, fallos de red, permisos, datos incompletos y validaciones fuertes.
- Regla de mantenimiento: este documento debe actualizarse siempre que un cambio de arquitectura, flujos, modelo de datos o configuracion publica lo requiera.

## Estructura del repositorio
- `frontend/`: app web (Vite + React + TypeScript + Tailwind + shadcn-ui).
- `backend/`: API REST (NestJS + Prisma + MySQL).
- `docker-compose.yml`: MySQL local (Docker).
- `scripts/`: dump/restore de DB.

## Stack y herramientas
Frontend:
- Vite + React 18 + TypeScript.
- Tailwind CSS + shadcn-ui (Radix UI).
- React Router, React Query.
- Firebase Web SDK (Auth).
- Otros: lucide-react, date-fns, recharts, sonner.

Backend:
- NestJS (REST) con validacion global (`ValidationPipe`: `whitelist` + `forbidNonWhitelisted` + `transform`).
- Prisma ORM sobre MySQL 8.
- Integraciones: ImageKit, Twilio, Firebase Admin, OpenAI, Nodemailer (SMTP).
- node-cron para jobs (recordatorios y sync de estados).

Infra/Dev:
- Docker Compose para MySQL.
- Prisma migrations + seed.

## Multi-tenant y resolucion de marca/local
**Backend**
- `TenantMiddleware` resuelve marca/local por `host` o `x-forwarded-host`.
- Overrides de tenant por cabecera (`x-tenant-subdomain`, `x-local-id`) controlados por entorno:
  - `TENANT_ALLOW_HEADER_OVERRIDES=true` permite override explícito (recomendado solo en dev/staging controlado).
  - En producción, por defecto quedan desactivados para evitar forzado de tenant desde cliente.
- `x-forwarded-host` también queda gobernado por entorno (`TENANT_TRUST_X_FORWARDED_HOST`) para evitar spoofing cuando no hay proxy confiable.
- Hardening proxy-aware en middleware: si `host` llega con valor interno (ej. `api`, `backend`, `localhost`, `*.local`) y existe `x-forwarded-host`, se usa este último como fallback para evitar `TENANT_SUBDOMAIN_REQUIRED` por reescritura de host en proxies.
- Fallback seguro de subdominio en peticiones browser: con overrides desactivados, `x-tenant-subdomain` solo se acepta si coincide con el subdominio inferido de `Origin`/`Referer` (evita bloqueos por host reescrito sin abrir override global).
- Generación de URLs absolutas sensibles (ej. pagos Stripe) reutiliza la misma política de confianza sobre `x-forwarded-*`.
- Soporta `customDomain` por marca.
- `PLATFORM_SUBDOMAIN` redirige al panel de plataforma.
- Contexto de tenant via `AsyncLocalStorage` (brandId/localId/host/subdomain).
- `TenantPrismaService` centraliza helpers de scoping (`localWhere`, `brandWhere`, `localData`, `brandData`) para reducir riesgo de queries sin tenant en código nuevo.
- `PrismaService` aplica un runtime guard tenant-safe en operaciones Prisma masivas de modelos tenant-scoped: exige `localId` y falla rápido si falta (bypass explícito solo para casos cross-tenant controlados).
- `TenantConfigService` combina configuracion de marca y de local (JSON) y expone config publica (branding/theme/adminSidebar/landing/features/business, logos por modo, flags de hero y visibilidad de acciones flotantes admin).
- `business.type` (brand-level, hereda a todos los locales) define el vocabulario usado en UI para staff y local.

**Frontend**
- `TenantProvider` llama `GET /api/tenant/bootstrap`.
- Guarda `localId` en localStorage (`managgio.localId`).
- Aplica theme por marca/local (`theme.primary`) y modo visual (`theme.mode` light/dark).
- Config publica incluye landing (orden + secciones ocultas) con override por local.
- Puede forzar subdominio con `VITE_TENANT_SUBDOMAIN`.
- `useBusinessCopy` normaliza el copy de staff/local (articulos y plurales) segun `business.type` y se usa en landing, reservas y panel admin.

## Arquitectura backend (NestJS)
Patrones globales:
- Prefijo global `/api`.
- ValidationPipe con `whitelist`, `forbidNonWhitelisted` y `transform`.
- `AdminGuard` global: solo protege endpoints marcados con `@AdminEndpoint`.

Modulos principales:
- **Tenancy**: resolucion de tenant y bootstrap (`/tenant/bootstrap`).
- **Users**: CRUD usuarios, sync con Firebase, roles admin, membresia de marca.
- **Roles**: roles admin por local (permisos por seccion).
- **Barbers**: gestion de barberos y calendario.
- **Barber Service Assignment**: reglas opcionales por local para limitar que servicios/categorias puede atender cada barbero.
- **Services**: servicios con precio/duracion, categorias opcionales.
- **Service Categories**: categorias de servicios (configurable).
- **Offers**: ofertas con descuentos para servicios y productos (por alcance y target).
- **Products**: catalogo de productos con stock, precio y visibilidad publica.
- **Product Categories**: categorias de productos (configurable).
- **Appointments**: CRUD citas, disponibilidad, estados, precio final y metodo de pago.
- **Loyalty**: tarjetas de fidelizacion (global/servicio/categoria), recompensas y progreso por cliente.
- **Referrals**: programa de referidos (config local, codigos, atribuciones, wallet/cupones, analitica).
- **Reviews**: reseñas inteligentes in-app (config local, requests, feedback privado y métricas).
- **Schedules**: horario del local y horarios por barbero (JSON), con descansos/buffer entre citas y tolerancia de cierre con overrides por dia/fecha.
- **Holidays**: festivos del local y por barbero.
- **Alerts**: banners/avisos con rango de fechas.
- **Settings**: configuracion del sitio (branding/contacto/horarios/sociales/stats visibles).
- **ImageKit**: firma y borrado de archivos.
- **Notifications**: emails + SMS + WhatsApp de recordatorio.
- **Cash Register**: movimientos de caja y agregados diarios por local/barbero.
- **Payments (Stripe)**: Stripe Connect, checkout y webhooks por local/marca.
- **AI Assistant**: chat/admin con tools y transcripcion.
- **Platform Admin**: gestion de marcas, locales y configuracion global.
- **Observability**: métricas UX/API por tenant y alerting operativo para plataforma.

Seguridad actual (importante):
- Endpoints admin se validan via `Authorization: Bearer <Firebase ID Token>` (JWT verificado en backend con Firebase Admin).
- `PlatformAdminGuard` exige `user.isPlatformAdmin`.
- `AiAssistantGuard` restringe a admins del local/plataforma.
- Endpoints de `users` endurecidos:
  - listado paginado (`GET /api/users`) solo admin (`@AdminEndpoint`),
  - consultas/ediciones/borrado de usuario exigen identidad autenticada y política `self-or-admin`,
  - creación de usuario en autoservicio valida que `firebaseUid/email` coincidan con el token y fuerza rol cliente.
- Endpoints públicos de referidos con identidad de propietario:
  - `GET /api/referrals/my-code` y `GET /api/referrals/my-summary` exigen usuario autenticado y validan `self-or-admin`.

## Arquitectura frontend
Entradas y layouts:
- Router por tenant: plataforma vs cliente.
- Code splitting por rutas con `React.lazy` + `Suspense` para separar carga publica, cliente, admin y plataforma.
- Layouts: `ClientLayout`, `AdminLayout`, `PlatformLayout`.
- Protecciones: `ProtectedRoute` por rol y plataforma.

Contextos principales:
- **AuthContext**: autentica con Firebase y sincroniza usuario con backend.
- **TenantContext**: carga tenant y configura theme.
- **AdminPermissionsContext**: permisos por rol (AdminRole + adminSidebar oculto por config).
- **NetworkStatusMonitor**: monitor global de conectividad (`online/offline`) con feedback inmediato al usuario.
- **AppErrorBoundary**: captura errores no controlados del arbol React y muestra fallback consistente con accion de recarga.
- **AuthSessionMonitor**: escucha expiracion de sesion (401/403 global) y fuerza logout + redireccion a `/auth`.
- **Carga diferida de Firebase SDK**: `frontend/src/lib/firebaseConfig.tsx` usa imports dinamicos (`firebase/app`, `firebase/auth`) y `AuthContext` inicializa Firebase bajo demanda al estar listo el tenant; evita incluir Firebase como dependencia estatica del `entry`.

Caching y sincronizacion frontend:
- **React Query como cache de dominio**: catalogos y settings usan claves por dominio y por `localId` (evita mezcla de datos entre locales).
- **Capa API modular por dominio**: los consumidores frontend importan desde `frontend/src/data/api/<dominio>.ts` (ej. `appointments`, `platform`, `payments`, `referrals`, `reviews`, `users`) sobre `frontend/src/data/api/request.ts`; `frontend/src/data/api.ts` queda solo como compatibilidad temporal para no romper migraciones.
- **CatalogQuery** (`frontend/src/lib/catalogQuery.ts`): acceso cacheado para servicios, barberos, categorias y productos (publico/admin), con `staleTime` corto para UX fluida.
- **OperationalQuery** (`frontend/src/lib/operationalQuery.ts`): cache compartida para consultas operativas acotadas (`appointments` por rango y `users` por `ids`) en vistas admin de alta frecuencia (dashboard, calendar, search, clients, quick appointment).
- **API paginada en frontend**: `frontend/src/data/api/users.ts` expone `getUsersPage` y `frontend/src/data/api/appointments.ts` expone `getAppointmentsPage` (respuesta `PaginatedResponse<T>`) como contrato principal para vistas admin masivas.
- **Retiro de helpers legacy en frontend**: se eliminan `getUsers()` y `getAppointments()` (lista completa) para evitar usos accidentales fuera de paginacion.
- **Cliente React Query real**: `ClientDashboard` y `AppointmentsPage` usan `useQuery` con claves por usuario/local (`client-appointments`, `client-loyalty-summary`, `client-referral-summary`) para deduplicar peticiones y reducir cargas manuales por `useEffect`.
- **Dashboards con React Query real**: `AdminDashboard` consume `GET /api/appointments/dashboard-summary` (ventana operativa de 30 dias y filtro opcional por barbero) y `PlatformDashboard` usa `platform-brands` + `platform-metrics(windowDays)`; ambos eliminan `useEffect + useState` para carga principal y refrescan via `refetch`/cache.
- **Landing query-driven**: `LandingPage` consume `useQuery` para `barbers`, `services`, `products(landing)` y `product-categories`, eliminando `loadData` imperativo y compartiendo cache de catalogo por `localId`.
- **Booking cacheado por dominio**: `BookingWizard` usa `useQuery` para bootstrap de reserva (`booking-bootstrap`), staff por servicio (`barbers(localId, serviceId)`), disponibilidad por fecha (`booking-slots`, single/batch), carga semanal (`booking-weekly-load`), preview de fidelizacion (`booking-loyalty-preview`), wallet (`rewards-wallet`) y estado de consentimiento (`privacy-consent-status`), reduciendo `useEffect + fetch` repetitivos.
- **Admin catalogos con React Query real**: `AdminServices`, `AdminOffers`, `AdminLoyalty` y `AdminStock` eliminan `loadData` manual y cargan con `useQuery` por `localId`/`target` (`services`, `service-categories`, `offers`, `loyalty-programs`, `products-admin`, `product-categories`, `site-settings`); tras mutaciones refrescan via `refetch` selectivo e invalidacion por dominio (`dispatchServicesUpdated` / `dispatchProductsUpdated`) para mantener coherencia de precios y catalogos.
- **Equipo admin query-driven**: `AdminBarbers` carga equipo y metadatos (`barbers`, `services`, `service-categories`, `site-settings`) con `useQuery`; tras CRUD/asignaciones refuerza consistencia con `refetch` del catálogo de barberos + eventos de dominio. La edición de horarios individuales mantiene carga on-demand por `barberId`.
- **Buscador de citas query-driven**: `AdminSearch` consume `useQuery` para citas paginadas agregadas (`GET /api/appointments/admin-search`, incluye `items + clients`), catálogo (`barbers`, `services`) y configuración Stripe (`admin-stripe-config`); elimina `loadData` manual y se sincroniza por invalidación de dominio + `refetch` en foco.
- **Clientes admin query-driven**: `AdminClients` consume `useQuery` para lista paginada de clientes (`admin-clients`), historial paginado por cliente (`admin-client-appointments`), notas internas (`admin-client-notes`), catálogo (`barbers`, `services`) y Stripe (`admin-stripe-config`), eliminando `loadData/loadClientAppointments` manuales y listeners globales.
- **Calendario admin query-driven**: `AdminCalendar` consume `useQuery` para `admin-calendar` (`GET /api/appointments/admin-calendar` con `items + clients`), catálogo (`barbers`, `services`) y Stripe (`admin-stripe-config`); mantiene la semana visible en cache y elimina `loadData` manual/listeners de `window`.
- **Referidos admin query-driven**: `AdminReferrals` consume `useQuery` para configuración (`adminReferralConfig`), analítica (`adminReferralOverview`), listado filtrable (`adminReferralList`) y catálogo de servicios (`services`), eliminando cargas manuales en `useEffect` y manteniendo sincronía por cache tras guardar/copiar.
- **Reseñas admin query-driven**: `AdminReviews` consume `useQuery` para configuración (`adminReviewConfig`), métricas por rango (`adminReviewMetrics`) y feedback paginado por estado (`adminReviewFeedback`), eliminando cargas manuales por efecto y actualizando cache al resolver feedback.
- **Alertas admin query-driven**: `AdminAlerts` consume `useQuery` (`adminAlerts`) para listado de avisos y elimina listeners manuales de `window`; las mutaciones (crear/editar/borrar/activar) refrescan por invalidación de dominio.
- **Festivos admin query-driven**: `AdminHolidays` consume `useQuery` para festivos generales (`adminGeneralHolidays`), festivos por staff (`adminBarberHolidays`) y catálogo de barberos (`barbers`), eliminando carga manual inicial y refrescando por `focus/visibility`.
- **PlatformBrands query-driven**: `PlatformBrands` consume `useQuery` con claves dedicadas (`platform-brands`, `platform-brand*`, `platform-location-config`) y `useMutation` para escrituras críticas (guardar marca/legal, CRUD de marca/local, asignación de admins), eliminando `load*` imperativos y centralizando refresco con `refetch` + `setQueryData`.
- **Acceso directo a web del cliente (Platform > Clientes > Datos)**: la pestaña `Datos` calcula y expone un enlace "Abrir web" para la marca seleccionada (prioriza `customDomain`; fallback a `{subdomain}.{baseDomain}` según entorno), permitiendo validar rápidamente la web pública sin salir del flujo de plataforma.
- **Controles flotantes por tenant (marca/local)**: `PlatformBrands` permite activar/desactivar por marca y con override por local la visibilidad de los iconos flotantes de admin (`Spotlight`/lupa y `Asistente IA`); `AdminLayout` consume los flags públicos `branding.adminSpotlightFloatingEnabled` y `branding.adminAssistantFloatingEnabled` (default visible).
- **Tipado fuerte en PlatformBrands**: se retiraron `any` explícitos en `PlatformBrands.tsx` para estado/config/modelos de marca/local/admin, reduciendo riesgo de errores silenciosos y mejorando mantenibilidad del flujo de plataforma.
- **Higiene de tipado en vistas clave**: se retiraron `any` explícitos en `AdminAiAssistant` (speech recognition tipado), `LandingPage` (secciones de presentacion) y `ReferralLandingPage` (payload de referidos), consolidando contratos fuertes en superficies de alto trafico.
- **Contratos API sin `any` (platform/referrals/payments)**: los modulos de dominio en `frontend/src/data/api/*.ts` consumen tipos explicitos de `frontend/src/data/types.ts` para marcas/locales/config/admins, codigos de referidos y respuestas Stripe (checkout/sesion/config/onboarding), reduciendo deuda tecnica y errores por contratos ambiguos.
- **Stripe tipado de extremo a extremo**: `AdminSettings` y `AdminCashRegister` consumen `AdminStripeConfig` compartido (sin casts locales), alineando backend/frontend con un contrato unico.
- **Caja registradora query-driven**: `AdminCashRegister` carga agenda/movimientos/catalogo y neto multi-local con `useQuery` (`cash-register`) y resuelve Stripe por `admin-stripe-config`; los movimientos de caja refrescan por `refetch` y propagan invalidacion de productos cuando hay operaciones sobre stock.
- **Configuracion admin query-driven**: `AdminSettings` carga `site-settings`, `shop-schedule` y `admin-stripe-config` con `useQuery`, manteniendo estado local solo para edicion de formulario y guardados explicitos; los refrescos de Stripe/disponibilidad pasan por `refetch`.
- **Referencias estables en vistas calientes**: dashboards y flujos cliente usan fallbacks memoizados para datos de query (evita recrear `[]/{}` en cada render y reduce renders derivados en `useMemo`/selectores).
- **Higiene de hooks en vistas criticas**: paginas admin/platform (`AdminSettings`, `AdminBarbers`, `AdminLoyalty`, `AdminOffers`, `AdminServices`, `AdminStock`, `AdminAiAssistant`, `AdminCashRegister`, `PlatformBrands`) y superficies publicas clave (`LandingPage`, `ReferralLandingPage`, `AdminSpotlight`) usan callbacks memoizados y dependencias exhaustivas para evitar closures obsoletos, efectos duplicados y renders evitables.
- **Invalidacion centralizada por eventos** (`frontend/src/lib/adminEvents.ts`): los `dispatch*Updated` invalidan automaticamente las query keys afectadas (`appointments/users/services/barbers/products`) antes de notificar por `window`.
- **Invalidacion acotada por local**: las invalidaciones por eventos admin filtran por `localId` en cache keys para evitar over-invalidate entre locales en la misma sesión.
- **Site settings coherentes**: `dispatchSiteSettingsUpdated` actualiza cache (`setQueryData`) + invalida prefijo `site-settings` y emite un unico evento tipado (`SITE_SETTINGS_UPDATED_EVENT`) consumido por `useSiteSettings` y `TenantContext`.
- **Refresco en primer plano**: `useForegroundRefresh` (`frontend/src/hooks/useForegroundRefresh.ts`) dispara recarga en `focus` y al volver la pestaña a visible, evitando polling constante en background.
- **Refresco foreground deduplicado**: `useForegroundRefresh` aplica throttle corto y callback estable para evitar doble `refetch` por eventos consecutivos (`focus` + `visibilitychange`).
- **Politica actual**: para refrescos periodicos/event-driven se prioriza cache + invalidacion de dominio; `force` queda solo para casos de conflicto o forzado explicito.

Observabilidad UX:
- Instrumentacion de Web Vitals en cliente (`LCP`, `CLS`, `INP`, `FCP`, `TTFB`) via `frontend/src/lib/webVitals.ts`.
- Envio de Web Vitals a backend (`POST /api/observability/web-vitals`) con `keepalive` para no bloquear navegacion.
- Emision de evento `window` `web-vital` para extensiones de analitica no acopladas.
- Interceptor global de API (`ApiMetricsInterceptor`) registra latencia/estado por ruta en backend.
- Resumen operativo solo plataforma: `GET /api/platform/observability/web-vitals?minutes=<n>` y `GET /api/platform/observability/api?minutes=<n>`.
- Persistencia de métricas en DB (`web_vital_events`, `api_metric_events`) con flush por lotes y retención configurable para no perder histórico en reinicios ni escalar horizontal.
- **UI operativa de observabilidad en plataforma**: ruta `GET /platform/observability` (frontend) con selector temporal `60 min | 24 h | 7 dias`, tablas de Web Vitals agregadas (`avg`, `p95`, `samples`) y Top endpoints API (`subdomain`, `avg`, `p95`, `errorRate`, `hits`) con `React Query` (`platform-observability-webvitals`, `platform-observability-api`), botón de refresco manual, tooltips discretos por card para interpretación rápida, leyenda breve de métricas UX, cards con altura máxima + scroll interno, layout responsive sin desbordes laterales en móvil y semáforo visual por fila (`OK`/`Vigilar`/`Crítico`) con resumen agregado por card para detección rápida.
- **Persistencia de navegación en Platform**: `PlatformLayout` guarda en `sessionStorage` (`platform:last-route:session`) la última sección (`/platform`, `/platform/brands`, `/platform/observability`) y restaura en primera carga si aterriza en `/platform`; `AuthPage` además respeta `location.state.from` (cuando `ProtectedRoute` envía a `/auth`) para volver directamente a la sección original tras refresco/login.
- Alertas operativas por email (event-driven, no periodicas): cuando llega un Web Vital en estado `poor` o cuando una ruta API entra en degradacion (5xx/p95 en ventana), backend envia correo con contexto (metrica, ruta, severidad, tenant, umbral y distribucion de estados). Incluye cooldown por clave para evitar spam.

Paginas clave:
- Publicas: Landing, Auth, Guest Booking, Hours/Location.
- Cliente: Dashboard, Booking Wizard, Appointments, Profile, Referrals.
- Admin: Dashboard, Calendar, Search, Clients, Services, Offers, Stock, Barbers, Alerts, Holidays, Roles, Settings, Cash Register, Loyalty, Referrals.
- Plataforma: Dashboard, Brands (gestion multi-tenant, landing reordenable por drag & drop y overrides por local), Observability (salud UX/API en tiempo casi real).

## Modelo de datos (Prisma / MySQL)
Tabla | Para que existe | Que guarda
---|---|---
User | Identidad y perfil | Datos del usuario, rol, preferencias, firebaseUid, flags admin
Brand | Marca/cliente | Subdominio, dominio custom, estado y local por defecto
Location | Local/sucursal | Relacion con Brand, nombre, slug, estado
AdminRole | Rol admin por local | Permisos por seccion (JSON)
BrandUser | Membresia marca-usuario | Vinculo usuario <-> marca + `isBlocked`
LocationStaff | Staff local | Vinculo usuario <-> local y rol admin
BrandConfig | Configuracion por marca | JSON (branding, theme, landing order/hidden, notification prefs, features, business.type, twilio, email, imagekit, ai, etc)
LocationConfig | Configuracion por local | JSON (branding overrides, theme, landing order/hidden, notification prefs, features, imagekit folder, adminSidebar)
Barber | Profesional | Datos, rol, disponibilidad, foto, userId asociado
Service | Servicio | Precio, duracion, categoria
ServiceCategory | Categoria | Orden y descripcion de servicios
BarberServiceAssignment | Asignacion directa barbero-servicio | Servicios concretos permitidos por barbero
BarberServiceCategoryAssignment | Asignacion por categoria | Categorias de servicios permitidas por barbero
Offer | Ofertas | Descuento por scope (all/categories/services/products) y target (service/product)
LoyaltyProgram | Fidelizacion | Scope (global/servicio/categoria), visitas requeridas, prioridad, activo
ReferralProgramConfig | Referidos local | Configuracion (recompensas, anti-fraude, expiracion, limites)
ReferralConfigTemplate | Referidos plantilla | Config base por marca (aplicable a locales)
ReferralCode | Codigo referido | Codigo unico por usuario+local
ReferralAttribution | Atribucion | Referido, estado lifecycle, expiracion, primera cita
RewardWallet | Wallet | Saldo por usuario+local
RewardTransaction | Ledger | Movimientos HOLD/DEBIT/CREDIT/COUPON
ReviewProgramConfig | Reseñas in-app | Configuración local (cooldown, link Google, copy, límites)
ReviewRequest | Solicitud reseña | Lifecycle (pending/shown/rated/etc), rating y feedback privado
Coupon | Cupon personal | Descuento %/fijo/servicio gratis por usuario
ProductCategory | Categoria producto | Orden y descripcion de productos
Product | Producto | Precio, stock, imagen, visibilidad y categoria
AppointmentProduct | Linea producto | Productos agregados a la cita (qty + precio unitario)
Appointment | Cita | Cliente, barbero, servicio, fecha, precio final, metodo de pago, estado, snapshot de nombres, fidelizacion, referidos, cupon, wallet, pagos Stripe (status/ids)
ClientNote | Notas internas admin | Comentarios privados por cliente (solo admin)
CashMovement | Movimiento de caja | Entradas/salidas manuales y operaciones de compra/venta de productos
CashMovementProductItem | Linea de movimiento de caja | Productos y cantidades asociados a una compra/venta de caja, con snapshot de nombre y precio unitario
PaymentMethod | Enum | Tarjeta, efectivo, bizum u otros metodos
PaymentStatus | Enum | pending/paid/failed/cancelled/exempt/in_person
Alert | Avisos | Mensajes con tipo y rango de fechas
GeneralHoliday | Festivo general | Rangos de cierre del local
BarberHoliday | Festivo de barbero | Rangos por barbero
ShopSchedule | Horario local | JSON con turnos diarios, descansos por dia (`breaks`) y por fecha (`breaksByDate`), `bufferMinutes`, y overflow de cierre (`endOverflowMinutes`, `endOverflowByDay`, `endOverflowByDate`)
BarberSchedule | Horario barbero | JSON con turnos diarios y overflow opcional por barbero (global, por dia de semana y por fecha fija)
SiteSettings | Configuracion sitio | JSON con branding, contacto, horarios y stats visibles (toggle por admin)
AiChatSession | Sesiones IA | Conversaciones por admin/local
AiChatMessage | Mensajes IA | Historial y tool payload
AiBusinessFact | Hechos IA | Datos fijos para contexto del asistente
WebVitalEvent | Observabilidad UX persistida | Eventos de Web Vitals por tenant (LCP/INP/CLS/FCP/TTFB)
ApiMetricEvent | Observabilidad API persistida | Latencia/estado por endpoint, tenant y subdominio
DistributedLock | Lock distribuido | Exclusión mutua por clave para crons en multi-instancia

## Legal & GDPR
Modelos nuevos:
- **BrandLegalSettings**: datos legales por marca (titular, contacto, versiones, subprocesadores, secciones custom, retencion).
- **ConsentRecord**: consentimiento por cita (tipo, version, texto, ip hash opcional).
- **AuditLog**: trazabilidad de cambios sensibles (legal, consentimientos, anonimizado).

Endpoints clave:
- Publicos tenant-aware: `GET /api/legal/privacy`, `GET /api/legal/cookies`, `GET /api/legal/notice`.
- Admin: `POST /api/appointments/:id/anonymize`.
- Plataforma: `GET/PUT /api/platform/brands/:id/legal/settings`, `GET /api/platform/brands/:id/legal/dpa`, `GET /api/platform/brands/:id/audit-logs`.
- La configuracion legal se gestiona desde plataforma; el panel admin del negocio no expone edicion.

Flujos:
- Booking requiere consentimiento de privacidad y se guarda con version + audit log.
- Cron de retencion itera marcas/locales y anonimiza citas antiguas segun `retentionDays`.
- El hash de IP usa `IP_HASH_SALT` si esta definido.

## Flujos clave (logica importante)
1) **Bootstrap tenant**
   - Front llama `/api/tenant/bootstrap`.
   - Backend resuelve subdominio o dominio custom.
   - Devuelve brand, locations, currentLocalId y config publica.

2) **Login y sincronizacion**
   - Firebase Auth maneja login/registro.
   - Inicializacion Firebase en frontend es lazy (dynamic import) cuando `AuthContext` entra en funcionamiento.
   - Front crea/actualiza User en backend.
   - El resultado de login en frontend se considera exitoso solo cuando termina la sincronizacion con backend (perfil/rol); si falla la sincronizacion se cancela la sesion local para evitar quedarse en `/auth` con toast de exito inconsistente.
   - El frontend usa `Authorization: Bearer <Firebase ID Token>` para endpoints admin.
   - Si API responde 401/403, se emite evento global de sesion y el frontend aplica logout/redirect consistente.
   - Si `BrandUser.isBlocked` esta activo, se bloquea el acceso del cliente a la app.
   - En booking, errores de red/timeout/offline/5xx se traducen a mensajes UX específicos para evitar feedback genérico en confirmaciones críticas.

3) **Disponibilidad de citas**
   - Se calcula por horario del barbero (por dia/turno) + horario del local.
   - Se excluyen festivos (local y por barbero) y descansos del local por dia (`breaks`) y por fecha concreta (`breaksByDate`).
   - Se aplica `bufferMinutes` del local a duraciones y solapes.
   - Slots base en intervalos de 15 min (`SLOT_INTERVAL_MINUTES`).
   - **Overflow de fin de jornada**: se calcula en cascada por prioridad `por fecha` -> `por dia` -> `global` (barbero primero y, si no hay override, local). Solo aplica al ultimo turno activo del dia.
   - **Relleno de huecos no alineados**: si hay un intervalo libre cuyo inicio no cae en un multiplo de 15, se agrega un unico slot extra en el minuto exacto del inicio del hueco para evitar huecos grandes sin saturar la UI.
   - Se computan rangos ocupados con duracion real del servicio + buffer, y se filtran slots que solapen.
   - Todas las comparaciones de dia/hora usan `APP_TIMEZONE` y helpers `startOfDayInTimeZone/endOfDayInTimeZone` para evitar errores de zona horaria.
   - En creacion/edicion de cita se valida disponibilidad dos veces: pre-check y verificacion final dentro de una transaccion serializable (si hay conflicto: “Horario no disponible”).
   - En frontend (cliente y admin), si el backend responde “Horario no disponible”, se muestra un mensaje explicito y se refrescan automaticamente los slots.
   - Para UI de booking sin seleccion fija de barbero, el frontend usa `GET /api/appointments/availability-batch?date=...&barberIds=...&serviceId=...` para resolver disponibilidad de multiples barberos en una sola llamada.
   - `availability-batch` resuelve datos compartidos en bloque (agenda de tienda, festivos, elegibilidad por servicio, citas del dia y horarios por barbero) para evitar patron N+1 en backend bajo carga.
   - La asignacion servicio-barbero solo aplica cuando **ambas** capas estan activas:
      - Toggle operativo local en `SiteSettings.services.barberServiceAssignmentEnabled`.
      - Toggle de plataforma en Tenant Config (`features.barberServiceAssignmentEnabled`), configurable por marca y override por local.
   - Si ambas estan activas, al elegir servicio solo se consideran barberos compatibles:
     - Coincidencia directa por servicio.
     - Coincidencia por categoria del servicio.
     - **Fallback obligatorio**: si un barbero no tiene ninguna asignacion (ni por servicio ni por categoria), se considera disponible para todos los servicios.
   - Si cualquiera de las dos capas esta desactivada, todos los barberos aplican para todos los servicios.

4) **Pricing y ofertas**
   - Price base del servicio y productos añadidos.
   - Se aplica la mejor oferta activa por target (service/product).
   - Se aplican cupones personales y wallet (si el cliente lo usa).
   - Wallet usa HOLD al confirmar y DEBIT al completar; si se cancela se libera.
   - Stripe: el cliente puede pagar online o en el local (si está habilitado).
   - Si el total es 0, se crea la cita sin cobrar online.
   - Se guarda `price` final en Appointment (editable en admin).
   - Caja registradora y KPIs usan el precio final (incluye productos).

5) **Notificaciones**
   - Email: al crear/actualizar/cancelar cita (SMTP via Nodemailer).
   - SMS/WhatsApp: recordatorio 24h antes (Twilio), respeta config por marca/local y preferencias del usuario.
   - Las preferencias del local sobrescriben las de marca.

6) **Sincronizacion de estados**
   - Job cron cada 5 min marca citas completadas cuando pasa el fin + grace.
   - `GET /api/appointments` ya no sincroniza estados de forma masiva en lectura (evita side-effects y latencia en listados grandes); la sincronizacion queda centralizada en el cron.
   - Job cron de recordatorios envia SMS y marca `reminderSent`.
   - Todos los crons operativos usan lock distribuido en DB para evitar ejecuciones duplicadas al escalar a múltiples instancias.

7) **Asistente IA**
   - `/api/admin/ai-assistant/chat` con tools para crear citas, alertas festivos.
   - Guarda sesiones/mensajes y resumen para contexto.
   - Transcripcion de audio con OpenAI (whisper-1).
   - Frontend persiste `sessionId` del asistente por `localId` (`ai-assistant-session-id:<localId>`) para evitar mezclar historiales entre locales.
   - Si `GET /api/admin/ai-assistant/session/:id` devuelve `404`, el frontend limpia la sesión persistida y continúa con chat nuevo (fallback silencioso).
 
8) **Caja registradora**
   - Combina citas (precio final, incluye productos) + movimientos manuales.
   - KPI principal `Citas del día`: suma solo citas completadas (servicios + productos de la cita), sin incluir movimientos manuales de caja.
   - Soporta movimientos de **compra/venta de productos sin cita** (venta suelta) desde caja.
   - Compra incrementa stock y venta decrementa stock en el inventario del local.
   - Si se elimina un movimiento de compra/venta, se revierte el ajuste de stock para mantener consistencia.
   - La opcion de compra/venta de productos solo aparece si el modulo de stock esta habilitado para el local.
   - KPIs por local y desglose por barbero/metodo de pago.

9) **Productos y stock**
   - El admin gestiona catalogo, stock y visibilidad publica por local.
   - Productos se agregan a las citas (admin y cliente si esta habilitado).
   - Al cancelar o marcar ausencia se revierte stock automaticamente.

10) **Branding y landing**
   - Configuracion por marca/local en plataforma (orden y visibilidad de secciones con drag & drop).
   - Los overrides de local tienen prioridad sobre la marca; hero siempre fijo primero.

11) **Spotlight (Admin Command Palette)**
   - Disponible en el panel admin para navegar rapido por secciones.
   - Atajo: `Ctrl/Cmd + B` (no interrumpe si el foco esta en un input editable).
   - Basado en `CommandDialog` (shadcn/ui) y items de `adminNavItems`.
   - Filtra por permisos (`AdminPermissionsContext`) y keywords.
   - Se integra en `AdminLayout` con `AdminSpotlightProvider` y un trigger flotante.
   - Secciones opcionales (ej. productos) se excluyen si el modulo esta desactivado.
   - Hero: se puede ocultar la imagen principal, cambiar su posicion, definir color del texto, ajustar opacidad del fondo, mostrar/ocultar la card de ubicacion, activar el badge de reserva online y alinear el contenido cuando no hay imagen.
   - Logos por modo: se guarda logo para modo claro/oscuro y se usa segun `theme.mode`.
   - Estadisticas destacadas se pueden mostrar/ocultar desde admin settings.

11) **Fidelizacion**
   - Programas por local con scope: global, categoria o servicio (prioridad y orden).
   - Solo cuentan citas `completed` para el progreso; el resto no suma.
   - La recompensa aplica solo al precio del servicio (productos se cobran).
   - Solo clientes registrados participan; invitados no acumulan.
   - Se guarda `loyaltyProgramId` y `loyaltyRewardApplied` en la cita.
   - El historial de recompensas se construye desde citas completadas con recompensa aplicada.

12) **Referidos**
   - Codigos por usuario+local (`/ref/:code`) y atribucion con expiracion.
   - Estados: ATTRIBUTED → BOOKED → COMPLETED → REWARDED (o EXPIRED/VOIDED).
   - Solo cuenta la primera cita completada del referido (no cancelada/no-show).
   - Anti-fraude: bloqueo auto-referido, duplicados por contacto, limite mensual por embajador.
   - Recompensas: wallet y/o cupon personal (%/fijo/servicio gratis).
   - Wallet usa HOLD/RELEASE/DEBIT para preparar pago real.

13) **Sincronizacion de cache UI (React Query + eventos admin)**
   - Cambios de citas disparan `dispatchAppointmentsUpdated` e invalidan `appointments` para refresco coherente en dashboard/calendar/search/clients.
   - Cambios de usuarios (bloqueos/rol admin/asignacion de rol) disparan `dispatchUsersUpdated` e invalidan `users` para sincronizar selectores y listados admin.
   - Cambios de servicios/categorias disparan `dispatchServicesUpdated` y se invalidan claves `services` + `service-categories`.
   - Cambios de barberos/horarios/festivos disparan `dispatchBarbersUpdated`/`dispatchSchedulesUpdated`/`dispatchHolidaysUpdated` e invalidan `barbers`.
   - Cambios de festivos invalidan también `holidays` (general + por staff) para sincronizar la vista de festivos sin recarga manual.
   - Cambios de alertas disparan `dispatchAlertsUpdated` e invalidan `alerts` para mantener coherencia en la gestión de banners.
   - Cambios de productos/categorias/imports y operaciones de caja con stock disparan `dispatchProductsUpdated` e invalidan `products` + `products-admin` + `product-categories`.
   - Cambios de `SiteSettings` usan `dispatchSiteSettingsUpdated` para actualizar al instante los consumidores activos (`useSiteSettings`, `TenantContext`) sin depender de recarga completa.
   - Las pantallas admin de alta frecuencia (dashboard/calendar/search/clients/quick appointment) recargan datos con cache compartida y sin forzar bypass en cada evento.
   - Calendar/search/clients/dashboard usan refresco por eventos + `focus/visibility` (sin polling periódico), reduciendo overfetch en segundo plano.
   - `AdminSearch` consume `GET /api/appointments/admin-search` (`page/pageSize` + filtros + `clients` visibles en la misma respuesta), eliminando la segunda llamada a usuarios por lote en cada paginado.
   - UX de `AdminSearch`: filtros de fecha y profesional persistidos por local en `localStorage` para mantener contexto tras recarga, y botón de recarga manual (`refetch`) sin forzar refresh completo de la página.
   - `AdminClients` ya no carga todas las citas del local al entrar; consume historial paginado por cliente (`GET /api/appointments?userId=...&page=...&pageSize=...&sort=desc`) y lista de clientes paginada (`GET /api/users?page=...&pageSize=...&role=client&q=...`) bajo `useQuery`, con notas internas cacheadas por cliente y refresco por invalidación de dominio.
   - `AdminCalendar` consume `GET /api/appointments/admin-calendar?dateFrom=...&dateTo=...&sort=asc` y recibe `items + clients` en la misma respuesta, eliminando la segunda llamada a usuarios por lote y manteniendo carga acotada a la semana visible.
   - UX de `AdminCalendar`: los bloques de cita priorizan hora/servicio/cliente con estado visual por fondo (sin punto redundante), color de acento por profesional y accesibilidad de foco; la línea horizontal de "hora actual" se superpone a la rejilla semanal (cuando incluye hoy), con control on/off y filtro de `barber` persistidos en `localStorage` por local, etiqueta `HH:mm` en la columna izquierda y botón de recarga manual de citas sin refrescar toda la página.
   - UX de `AdminSettings` (local): la pantalla de `Configuración` se compartimenta en pestañas internas relacionadas (`Identidad y landing`, `Operativa`, `Agenda y horarios`) para reducir longitud percibida y carga cognitiva; la pestaña activa se persiste en `sessionStorage` (`admin-settings-active-tab`) para mantener contexto tras recarga. En "Estadísticas destacadas", la visibilidad de cada métrica se controla con toggles inline junto al propio campo (sin subcard separada) para simplificar la lectura. El guardado se centraliza en un único botón contextual junto al navbar de pestañas (alineado a la derecha) que actúa según la pestaña activa.
   - UX de disponibilidad (`AdminSettings`): en "Descansos y tiempos entre servicios" se configuran descansos por dia + descansos por fecha concreta, y overflow de cierre con override global/por-dia/por-fecha. La tolerancia semanal y por fecha se edita dentro de una sola card para evitar fragmentacion visual, y los bloques de "Huecos por fecha concreta" usan layout compacto (controles agrupados) para lectura/edicion mas rapida.
   - UX de horario por profesional (`AdminBarbers`): el modal de horario se organiza en pestañas internas (`Horario` y `Tolerancia`, por defecto abre en `Horario`) y permite ajuste de overflow de cierre por profesional a nivel global, por dia de semana y por fecha fija (si no hay valor, hereda del local).
   - `AdminReferrals` carga configuración/analítica/listado con `useQuery` (`adminReferralConfig`, `adminReferralOverview`, `adminReferralList`) y aplica filtros (`status`, `q`) con debounce en el listado, evitando fetch manual por efecto en cada render.
   - `AdminReviews` carga configuración/métricas/feedback con `useQuery` (`adminReviewConfig`, `adminReviewMetrics`, `adminReviewFeedback`) y el cierre de feedback actualiza cache de la lista activa sin recargar toda la pantalla.
   - `AdminDashboard` usa un endpoint agregado (`GET /api/appointments/dashboard-summary?window=30[&barberId=...]`) que devuelve KPIs/series/listado diario ya procesados, evitando descargar citas + usuarios + servicios completos para construir gráficas en cliente.
   - `BookingWizard` inicializa catalogo/configuracion de reserva via `useQuery` (`booking-bootstrap`), resuelve disponibilidad de slots (single/batch) y carga semanal por barbero con claves dedicadas (`booking-slots`, `booking-weekly-load`), y mantiene fidelizacion/wallet/consentimiento bajo cache (`booking-loyalty-preview`, `rewards-wallet`, `privacy-consent-status`), evitando sobrecarga de `useEffect` manual.
   - `AdminRoles` opera con `useQuery` (`admin-roles`, `admin-role-users`, `admin-role-search`) y deja de cargar todos los usuarios del local en cada cambio: carga administradores por paginacion (`GET /api/users?page=...&pageSize=...&role=admin`) y el buscador usa consulta paginada (`q`) bajo demanda con debounce.
   - UX de `AdminRoles`: el modal de crear/editar rol mantiene altura estable con scroll interno, y la matriz de permisos se limita a secciones realmente visibles en el sidebar del local (no muestra secciones ocultas por configuración de tenant).
   - `QuickAppointmentButton` deja de precargar clientes completos: el selector de cliente hace busqueda server-side paginada (`GET /api/users?page=1&pageSize=25&role=client&q=...`) con debounce.
   - `PlatformDashboard` consume `useQuery` para marcas y consumo (`platform-brands`, `platform-metrics`) y la accion "Recargar" actualiza cache con `setQueryData` tras `POST /api/platform/metrics/refresh`.
   - UX en `PlatformDashboard`: acceso directo al CRM (`https://managgio.com/admin`) desde el encabezado (visible solo en producción real bajo `managgio.com`) y visual de capacidad de ImageKit con barra de progreso (en lugar de serie temporal) para lectura operativa rápida.
   - `PlatformObservability` consume `useQuery` para resumen de experiencia/API (`platform-observability-webvitals`, `platform-observability-api`) sobre ventana seleccionable (`minutes`) y permite refresh manual sin polling continuo.
   - `PlatformBrands` centraliza lecturas de plataforma en `useQuery` y escrituras en `useMutation` (sin `loadBrands/loadBrandDetails/loadLegalInfo`); la sincronización post-mutación se resuelve por `refetch` de dominio + `setQueryData` en legal, y evita doble carga de config de local al cambiar de marca.
   - Al confirmar una reserva en cliente, `BookingWizard` invalida caches relacionadas (`client-appointments`, `client-loyalty-summary`, `client-referral-summary`, `rewards-wallet`, `booking-loyalty-preview`) y emite `dispatchAppointmentsUpdated` para coherencia inmediata entre vistas cliente/admin.

## Integraciones externas
- **ImageKit**: firma y subida de imagenes. Carpetas por marca/local; al reemplazar activos se elimina el archivo anterior.
- **Twilio**: SMS y WhatsApp (templates) 24h antes de la cita.
- **Firebase**: Auth en frontend + Admin SDK en backend (borrado usuario).
- **OpenAI**: chat + transcripcion para asistente admin.
- **SMTP (Nodemailer)**: emails transaccionales.
- **Stripe**: pagos online con Stripe Connect + webhooks (visible solo si marca y local lo habilitan).
- **Google Maps**: URLs guardadas en SiteSettings para ubicacion.

## Configuracion por entorno (resumen)
Backend (`backend/.env`):
- DB: `DATABASE_URL`.
- Tenant defaults: `DEFAULT_BRAND_ID`, `DEFAULT_LOCAL_ID`, `DEFAULT_BRAND_SUBDOMAIN`, `TENANT_BASE_DOMAIN`, `PLATFORM_SUBDOMAIN`, `TENANT_REQUIRE_SUBDOMAIN`, `PLATFORM_ADMIN_EMAILS`.
- Hardening tenant resolution: `TENANT_ALLOW_HEADER_OVERRIDES`, `TENANT_TRUST_X_FORWARDED_HOST`.
- Runtime guard tenant en Prisma: `TENANT_SCOPE_RUNTIME_GUARD` (por defecto activo; desactivar solo en escenarios controlados de mantenimiento).
- CORS: `CORS_ALLOWED_ORIGINS` (lista separada por comas para allowlist explícita en despliegue).
- ImageKit: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_FOLDER`.
- Twilio: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_SID`, `TWILIO_ACCOUNT_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_TEMPLATE_SID`, `TWILIO_SMS_COST_USD` (opcional).
- Email: `EMAIL`, `PASSWORD`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM_NAME`.
- Observability alerts: `OBSERVABILITY_ALERT_EMAILS` (comma-separated, default `executive.managgio@gmail.com`), `OBSERVABILITY_ALERT_COOLDOWN_MINUTES`, `OBSERVABILITY_ALERT_API_WINDOW_MINUTES`, `OBSERVABILITY_ALERT_API_MIN_SAMPLES`, `OBSERVABILITY_ALERT_API_ERROR_RATE_PERCENT`, `OBSERVABILITY_ALERT_API_ERROR_MIN_COUNT`, `OBSERVABILITY_ALERT_API_P95_MS`.
- Observability persistence: `OBSERVABILITY_PERSIST_FLUSH_MS`, `OBSERVABILITY_PERSIST_BATCH_SIZE`, `OBSERVABILITY_PERSIST_BUFFER_LIMIT`, `OBSERVABILITY_PERSIST_RETENTION_DAYS`, `OBSERVABILITY_SUMMARY_QUERY_CAP`.
- Distributed locks: `DISTRIBUTED_LOCK_PREFIX` (namespace de locks compartidos entre instancias).
- AI: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE`, `AI_TRANSCRIPTION_MODEL`.
- Firebase Admin: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.
- Legal: `IP_HASH_SALT` (hash IP para consentimientos).
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

Frontend (`frontend/.env*`):
- `VITE_API_BASE_URL` (API).
- Firebase web config: `VITE_FIREBASE_*`.
- `VITE_TENANT_SUBDOMAIN` (override opcional).
- `VITE_IMAGEKIT_FOLDER_PREFIX` (preview en panel plataforma).

## Operativa y desarrollo
- MySQL local con Docker: `docker compose up -d`.
- Backend: `npm install`, `npx prisma generate`, `npx prisma migrate dev`, `npm run prisma:seed`, `npm run start:dev`.
- Frontend: `npm install`, `npm run dev`.
- Scripts DB: `scripts/db_dump.sh` y `scripts/db_restore.sh`.

### Guardrails de performance (frontend)
- Baseline reproducible: `cd frontend && npm run perf:baseline`.
- Build con sourcemap para analisis: `npm run build:perf`.
- Reporte de bundle e impacto por modulos: `npm run perf:report`.
- Validacion automatica de presupuestos (exit code 1 si falla): `npm run perf:check`.
- Presupuestos actuales en: `frontend/perf-budgets.json`.
- Reportes generados en: `docs/perf/PERF_BASELINE.md` y `docs/perf/bundle-report.json`.
- CI de budgets: workflow `/.github/workflows/frontend-perf-budget.yml` ejecuta `npm run perf:baseline` en PR/push y falla si se exceden umbrales.
- Capa de red robusta: `apiRequest` usa timeout explicito, retry con backoff para `GET` idempotentes (errores de red/timeout y HTTP transitorios), clasifica errores (`HTTP`, `TIMEOUT`, `OFFLINE`, `NETWORK`, `ABORTED`) y emite evento global de sesion para 401/403.
- Recharts: usar imports selectivos (`import { LineChart, ... } from 'recharts'`) y evitar namespace imports (`import * as Recharts...`) para no inflar chunks.
- `manualChunks` en Vite separa vendors base por grupos estables (`vendor-react`, `vendor-router`, `vendor-query`, `vendor-radix`, `vendor-icons`, `vendor-ui-utils`, `vendor-misc`) y mantiene chunks dedicados para pesos altos (`vendor-firebase`, `vendor-charts`, `vendor-date`) para evitar warnings de tamaño y preservar carga incremental.
- Despliegue frontend debe ser atomico (`index.html` + `assets/*` del mismo build) y con invalidacion de cache/CDN para evitar mezclar chunks de builds distintos.
- Carga de fuentes optimizada en `frontend/index.html` con `preconnect` + `preload`/`stylesheet` (sin `@import` bloqueante en CSS).
- Higiene de imagenes en rutas criticas: logos/avatares/QR y miniaturas usan `loading`, `decoding` y dimensiones explicitas para reducir CLS y trabajo de render en navegacion.
- Branding estático responsive en puntos críticos (`AuthPage`, `PlatformSidebar`) con `<picture>` + `AVIF/WebP` + `srcSet/sizes`:
  - Hero plataforma: `fondo-managgio-960/1440.(avif|webp)`.
  - Logo plataforma: `logo-app-80/160.(avif|webp)`.
  - Fallback en `<img>` sobre variantes WebP (`-160` / `-1440`) para compatibilidad sin arrastrar PNG pesados al build.
- Política de carga de imágenes: todas las etiquetas `<img>` declaran `loading` explícito; `eager` queda reservado a assets críticos above-the-fold (hero/logos de cabecera), y el resto usa `lazy`.
- React Query aplica retry inteligente segun tipo de error para evitar reintentos inutiles (ej. 401/403/404 u offline).
- Invalida cache por eventos de dominio en lugar de forzar refetch global, reduciendo overfetch y manteniendo consistencia multi-pantalla.
- Higiene de compatibilidad de navegadores: mantener `caniuse-lite/browserslist` actualizado (`npx update-browserslist-db@latest`) para evitar warnings y asegurar targets vigentes de build.
- Verificacion operativa de hooks/renders: ejecutar `npx eslint src --rule '@typescript-eslint/no-explicit-any: off'` y mantener en `0` los warnings de `react-hooks/exhaustive-deps` y `react-refresh/only-export-components`.
- Higiene de lint en React Fast Refresh: `react-refresh/only-export-components` mantiene regla activa, con allowlist explícita solo para hooks/utilidades compartidas (`useAuth`, `useTenant`, `useAdminPermissions`, `useAdminSpotlight`, `cropAndCompress`, `buttonVariants`, `toggleVariants`) y sin exports auxiliares innecesarios en componentes UI.

### Guardrails de performance (backend)
- Endpoints masivos con contrato paginado:
  - `GET /api/users?page=<n>&pageSize=<m>[&role=client|admin][&q=texto]` devuelve `{ total, page, pageSize, hasMore, items }`.
  - `GET /api/appointments?page=<n>&pageSize=<m>[&userId=&barberId=&date=][&dateFrom=&dateTo=][&sort=asc|desc]` devuelve `{ total, page, pageSize, hasMore, items }`.
- Endpoint agregado para carga operativa semanal: `GET /api/appointments/weekly-load?dateFrom=...&dateTo=...[&barberIds=id1,id2]` devuelve conteos por barbero sin payload de citas.
- Endpoint agregado para dashboard admin: `GET /api/appointments/dashboard-summary?window=<n>[&barberId=<id>]` devuelve KPIs, series de ingresos/ticket, mix de servicios, ocupacion y citas de hoy ya agregadas.
- Endpoint agregado para búsqueda admin: `GET /api/appointments/admin-search?page=<n>&pageSize=<m>[&barberId=<id>][&date=<yyyy-mm-dd>]` devuelve `{ total, page, pageSize, hasMore, items, clients }`.
- Endpoint agregado para calendario admin: `GET /api/appointments/admin-calendar?dateFrom=...&dateTo=...[&barberId=<id>][&sort=asc|desc]` devuelve `{ items, clients }` (sin segunda consulta a `/users`).
- Endpoint operativo de salud por marca en plataforma: `GET /api/platform/brands/:id/health` devuelve estado agregado por local e integración (`email`, `twilio`, `stripe`, `imagekit`, `ai`) para detectar credenciales/fuentes degradadas antes de impacto en clientes.
- Resolucion puntual de usuarios para listados paginados: `GET /api/users?ids=<id1,id2,...>` devuelve solo los usuarios solicitados (acotado al tenant actual).
- Configuración plataforma (`PATCH /api/platform/brands/:id/config` y `PATCH /api/platform/locations/:id/config`) acepta `data` objeto, incluyendo `{}` para limpiar overrides sin romper el guardado de marca/local.
- El formato legacy de lista completa para `/users` y `/appointments` queda retirado del contrato backend.
- `UsersService` normaliza emails sensibles (`trim + lowercase`) al resolver superadmin por marca (`superAdminEmail`) para evitar desalineaciones por espacios/case en primer login.
- Gate automático de aislamiento tenant en CI: `npm run tenant:scope:check` valida que consultas Prisma masivas en modelos tenant-scoped incluyan `localId`/`brandId` (workflow `backend-hardening.yml`).
- `UsersService.update/remove` opera con scope de marca actual:
  - no permite actualizar usuarios fuera de `brandId` activo,
  - y en borrado elimina membresía/datos del usuario acotados a la marca actual antes de borrar globalmente (solo si no quedan membresías en otras marcas).
- `syncAppointmentStatuses` procesa efectos de cierre en lotes (`BATCH_SIZE=20`) para evitar secuencias largas por cita en ciclos de sincronizacion con volumen alto.
- Observabilidad backend:
  - `POST /api/observability/web-vitals` recibe métricas UX de cliente.
  - `GET /api/platform/observability/web-vitals` y `GET /api/platform/observability/api` exponen resumen de Web Vitals y latencia/errores por ruta para plataforma; el resumen API incluye dimensión `subdomain` por fila.
  - Persistencia: los eventos se almacenan en MySQL (`web_vital_events`, `api_metric_events`) con cola/batch en memoria para escritura eficiente y tolerancia a reinicios.
  - Alertas email automáticas (sin cron): disparo por evento degradado con cooldown configurable para evitar ruido.
- Indices de consultas calientes en `Appointment`:
  - `(localId, startDateTime)`
  - `(localId, barberId, startDateTime)`
  - `(localId, userId, startDateTime)`
  - `(localId, status, startDateTime)`
- Indices operativos adicionales para volumen alto:
  - `ReferralCode(localId, createdAt)`
  - `RewardTransaction(localId, status, createdAt)`
  - `CashMovement(localId, occurredAt)` y `CashMovement(localId, createdAt)`
  - `ClientNote(localId, userId, createdAt)`
  - `WebVitalEvent(localId, timestamp)` y `ApiMetricEvent(localId, timestamp)`

## Seguridad, riesgos y casuisticas (checklist rapido)
- **Auth admin por JWT**: `Authorization: Bearer <Firebase ID Token>` verificado en backend.
- **Expiración JWT**: los ID tokens expiran y se renuevan en el cliente; manejar 401/403 y reintentos si aplica.
- **CORS**: habilitado global; mantener allowlist estricta en despliegue.
- **Multi-tenant**: validar siempre `localId` en queries (ya se usa `getCurrentLocalId`).
- **Jobs cron**: iteran por marca/local para evitar usar `DEFAULT_LOCAL_ID` en multi-tenant.
- **Cron multi-instancia**: los jobs críticos se ejecutan bajo lock distribuido para evitar duplicidades al escalar horizontal.
- **Datos incompletos**: flows permiten `guestName`/`guestContact` sin userId.
- **Email/SMS**: si faltan credenciales, notificaciones se deshabilitan (log warn).
- **IA**: si no hay API key, el endpoint falla; manejar fallback.
- **ImageKit**: folder y credenciales deben estar presentes o falla firma/borrado.
- **Validaciones**: DTOs reforzados (plataforma: marcas/locales/admins/config) + `forbidNonWhitelisted` global para rechazar campos inesperados.

## Puntos de fallo comunes (para debug rapido)
- Subdominio invalido: `TENANT_SUBDOMAIN_REQUIRED` o `TENANT_NOT_FOUND`.
- Sin `Authorization` (Bearer): endpoints admin devuelven 401/403.
- Precio de cita incorrecto: revisar ofertas activas y categoria/servicio.
- Slots vacios: revisar horario del barbero, festivos o duracion.
- No llegan recordatorios: revisar Twilio + `notificationPrefs` (sms/whatsapp) + preferencias del usuario.

## Principios de desarrollo continuo
- Mantener componentes/servicios pequenos y reutilizables.
- Evitar acoplamientos entre UI y API (importar desde `data/api/<dominio>.ts`; no volver al monolito).
- Documentar cambios en flujos criticos (citas, pricing, multi-tenant).
- Cualquier cambio con impacto arquitectonico o en flujos base debe reflejarse en este `ARCHITECTURE.md` en el mismo PR/cambio.
- Tests minimos para logica de scheduling, pricing y permisos.

## Contrato de ingenieria (obligatorio para todo desarrollo nuevo)
Este contrato define el estandar minimo de calidad tecnica de Managgio. Cualquier PR nuevo debe cumplirlo para considerarse terminado.

### 1) Reglas de arquitectura y rendimiento (no negociables)
- No introducir imports eager que rompan el code splitting por dominio (public/client/admin/platform/legal).
- Toda pantalla o modulo pesado nuevo debe cargarse con `React.lazy` cuando no sea critico de `entry`.
- No introducir imports desde `@/data/api.ts` en codigo nuevo; usar `@/data/api/<dominio>` para preservar el aislamiento de bundles.
- En charts, evitar `import * as Recharts...`; usar imports selectivos de componentes requeridos.
- No romper budgets de frontend definidos en `frontend/perf-budgets.json`.
- No reintroducir fetch manual duplicado si ya existe contrato equivalente en React Query.
- No reintroducir endpoints de lista completa para recursos masivos (`users`, `appointments`): siempre paginacion o endpoint agregado.
- Mantener invalidacion de cache por dominio/evento; evitar `refetch` global indiscriminado.
- En React Query, no llamar `queryClient.fetchQuery` dentro de `queryFn` con la misma `queryKey` (riesgo de carga infinita por dependencia circular). Para cache de apoyo, usar `getQueryData/getQueryState + setQueryData` o prefetch fuera de `queryFn`.
- Accesibilidad obligatoria en modales: todo `DialogContent` debe incluir `DialogTitle` y `DialogDescription` (visible o `sr-only`) para evitar warnings de Radix y mantener semántica consistente.
- Mantener contratos tipados end-to-end; evitar `any` salvo excepcion justificada y documentada.

### 2) Reglas de robustez y seguridad
- Toda llamada de red debe usar la capa comun de request (`timeout`, `retry` idempotente, errores tipados, 401/403 global).
- Toda nueva superficie admin/plataforma debe validar payload con DTO y respetar `forbidNonWhitelisted`.
- No exponer secretos ni logica sensible en frontend.
- Cualquier cambio multi-tenant debe validar aislamiento por `localId`/`brandId`.
- Errores de UX deben tener fallback consistente (sin pantallas rotas o estados silenciosos).

### 3) Regla documental (obligatoria)
- Si cambia arquitectura, contratos API, flujos clave, indices, observabilidad o guardrails:
  - Actualizar `docs/ARCHITECTURE.md` en el mismo PR.
  - Actualizar `docs/perf/PERF_BASELINE.md` si hay impacto de performance medible.
  - No dejar secciones en contradiccion (si se reemplaza un flujo, retirar el flujo anterior del documento).

### 4) Definition of Done por PR (checklist minimo)
- Build frontend y backend en verde.
- Lint en verde (sin nuevos warnings criticos).
- Budgets de performance en verde (`npm run perf:baseline`).
- Sin regresion de lazy loading (el dominio publico no debe arrastrar codigo admin/platform innecesario).
- Sin regresion de contratos paginados/agregados en endpoints masivos.
- `ARCHITECTURE.md` actualizado si aplica.

### 5) Politica de excepciones
- Solo se permite romper una regla de este contrato con:
  - motivo tecnico concreto,
  - impacto explicitado (perf/seguridad/UX),
  - plan de remediacion con fecha,
  - y registro en este `ARCHITECTURE.md` o en el PR correspondiente.
