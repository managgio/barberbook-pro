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
- NestJS (REST) con validacion global (`ValidationPipe`).
- Prisma ORM sobre MySQL 8.
- Integraciones: ImageKit, Twilio, Firebase Admin, OpenAI, Nodemailer (SMTP).
- node-cron para jobs (recordatorios y sync de estados).

Infra/Dev:
- Docker Compose para MySQL.
- Prisma migrations + seed.

## Multi-tenant y resolucion de marca/local
**Backend**
- `TenantMiddleware` resuelve marca/local por `host` o `x-forwarded-host`.
- Soporta overrides: `x-tenant-subdomain` y `x-local-id` (usado en frontend).
- Soporta `customDomain` por marca.
- `PLATFORM_SUBDOMAIN` redirige al panel de plataforma.
- Contexto de tenant via `AsyncLocalStorage` (brandId/localId/host/subdomain).
- `TenantConfigService` combina configuracion de marca y de local (JSON) y expone config publica (branding/theme/adminSidebar/landing, logos por modo y flags de hero).

**Frontend**
- `TenantProvider` llama `GET /api/tenant/bootstrap`.
- Guarda `localId` en localStorage (`managgio.localId`).
- Aplica theme por marca/local (`theme.primary`) y modo visual (`theme.mode` light/dark).
- Config publica incluye landing (orden + secciones ocultas) con override por local.
- Puede forzar subdominio con `VITE_TENANT_SUBDOMAIN`.

## Arquitectura backend (NestJS)
Patrones globales:
- Prefijo global `/api`.
- ValidationPipe con `whitelist` y `transform`.
- `AdminGuard` global: solo protege endpoints marcados con `@AdminEndpoint`.

Modulos principales:
- **Tenancy**: resolucion de tenant y bootstrap (`/tenant/bootstrap`).
- **Users**: CRUD usuarios, sync con Firebase, roles admin, membresia de marca.
- **Roles**: roles admin por local (permisos por seccion).
- **Barbers**: gestion de barberos y calendario.
- **Services**: servicios con precio/duracion, categorias opcionales.
- **Service Categories**: categorias de servicios (configurable).
- **Offers**: ofertas con descuentos para servicios y productos (por alcance y target).
- **Products**: catalogo de productos con stock, precio y visibilidad publica.
- **Product Categories**: categorias de productos (configurable).
- **Appointments**: CRUD citas, disponibilidad, estados, precio final y metodo de pago.
- **Loyalty**: tarjetas de fidelizacion (global/servicio/categoria), recompensas y progreso por cliente.
- **Referrals**: programa de referidos (config local, codigos, atribuciones, wallet/cupones, analitica).
- **Reviews**: reseñas inteligentes in-app (config local, requests, feedback privado y métricas).
- **Schedules**: horario del local y horarios por barbero (JSON), con descansos y buffer entre citas.
- **Holidays**: festivos del local y por barbero.
- **Alerts**: banners/avisos con rango de fechas.
- **Settings**: configuracion del sitio (branding/contacto/horarios/sociales/stats visibles).
- **ImageKit**: firma y borrado de archivos.
- **Notifications**: emails + SMS + WhatsApp de recordatorio.
- **Cash Register**: movimientos de caja y agregados diarios por local/barbero.
- **Payments (Stripe)**: Stripe Connect, checkout y webhooks por local/marca.
- **AI Assistant**: chat/admin con tools y transcripcion.
- **Platform Admin**: gestion de marcas, locales y configuracion global.

Seguridad actual (importante):
- Endpoints admin se validan via `Authorization: Bearer <Firebase ID Token>` (JWT verificado en backend con Firebase Admin).
- `PlatformAdminGuard` exige `user.isPlatformAdmin`.
- `AiAssistantGuard` restringe a admins del local/plataforma.

## Arquitectura frontend
Entradas y layouts:
- Router por tenant: plataforma vs cliente.
- Layouts: `ClientLayout`, `AdminLayout`, `PlatformLayout`.
- Protecciones: `ProtectedRoute` por rol y plataforma.

Contextos principales:
- **AuthContext**: autentica con Firebase y sincroniza usuario con backend.
- **TenantContext**: carga tenant y configura theme.
- **AdminPermissionsContext**: permisos por rol (AdminRole + adminSidebar oculto por config).

Paginas clave:
- Publicas: Landing, Auth, Guest Booking, Hours/Location.
- Cliente: Dashboard, Booking Wizard, Appointments, Profile, Referrals.
- Admin: Dashboard, Calendar, Search, Clients, Services, Offers, Stock, Barbers, Alerts, Holidays, Roles, Settings, Cash Register, Loyalty, Referrals.
- Plataforma: Dashboard, Brands (gestion multi-tenant, landing reordenable por drag & drop y overrides por local).

## Modelo de datos (Prisma / MySQL)
Tabla | Para que existe | Que guarda
---|---|---
User | Identidad y perfil | Datos del usuario, rol, preferencias, firebaseUid, flags admin
Brand | Marca/cliente | Subdominio, dominio custom, estado y local por defecto
Location | Local/sucursal | Relacion con Brand, nombre, slug, estado
AdminRole | Rol admin por local | Permisos por seccion (JSON)
BrandUser | Membresia marca-usuario | Vinculo usuario <-> marca + `isBlocked`
LocationStaff | Staff local | Vinculo usuario <-> local y rol admin
BrandConfig | Configuracion por marca | JSON (branding, theme, landing order/hidden, twilio, email, imagekit, ai, etc)
LocationConfig | Configuracion por local | JSON (branding overrides, theme, landing order/hidden, imagekit folder, adminSidebar)
Barber | Profesional | Datos, rol, disponibilidad, foto, userId asociado
Service | Servicio | Precio, duracion, categoria
ServiceCategory | Categoria | Orden y descripcion de servicios
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
CashMovement | Movimiento de caja | Entradas/salidas manuales y metodo de pago
PaymentMethod | Enum | Tarjeta, efectivo, bizum u otros metodos
PaymentStatus | Enum | pending/paid/failed/cancelled/exempt/in_person
Alert | Avisos | Mensajes con tipo y rango de fechas
GeneralHoliday | Festivo general | Rangos de cierre del local
BarberHoliday | Festivo de barbero | Rangos por barbero
ShopSchedule | Horario local | JSON con turnos diarios, descansos por dia, `bufferMinutes` y `endOverflowMinutes`
BarberSchedule | Horario barbero | JSON con turnos diarios y `endOverflowMinutes` (override opcional por barbero)
SiteSettings | Configuracion sitio | JSON con branding, contacto, horarios y stats visibles (toggle por admin)
AiChatSession | Sesiones IA | Conversaciones por admin/local
AiChatMessage | Mensajes IA | Historial y tool payload
AiBusinessFact | Hechos IA | Datos fijos para contexto del asistente

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
   - Front crea/actualiza User en backend.
   - El frontend usa `Authorization: Bearer <Firebase ID Token>` para endpoints admin.
   - Si `BrandUser.isBlocked` esta activo, se bloquea el acceso del cliente a la app.

3) **Disponibilidad de citas**
   - Se calcula por horario del barbero (por dia/turno) + horario del local.
   - Se excluyen festivos (local y por barbero) y descansos por dia.
   - Se aplica `bufferMinutes` del local a duraciones y solapes.
   - Slots base en intervalos de 15 min (`SLOT_INTERVAL_MINUTES`).
   - **Overflow de fin de jornada**: `endOverflowMinutes` permite aceptar servicios que terminen un poco despues del cierre (solo en el ultimo turno del dia). Si no hay valor, no se excede el horario oficial.
   - `endOverflowMinutes` se configura a nivel local y puede sobrescribirse por barbero (si no hay valor, hereda del local).
   - **Relleno de huecos no alineados**: si hay un intervalo libre cuyo inicio no cae en un multiplo de 15, se agrega un unico slot extra en el minuto exacto del inicio del hueco para evitar huecos grandes sin saturar la UI.
   - Se computan rangos ocupados con duracion real del servicio + buffer, y se filtran slots que solapen.
   - Todas las comparaciones de dia/hora usan `APP_TIMEZONE` y helpers `startOfDayInTimeZone/endOfDayInTimeZone` para evitar errores de zona horaria.
   - En creacion/edicion de cita se valida disponibilidad dos veces: pre-check y verificacion final dentro de una transaccion serializable (si hay conflicto: “Horario no disponible”).
   - En frontend (cliente y admin), si el backend responde “Horario no disponible”, se muestra un mensaje explicito y se refrescan automaticamente los slots.

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
   - Job cron de recordatorios envia SMS y marca `reminderSent`.

7) **Asistente IA**
   - `/api/admin/ai-assistant/chat` con tools para crear citas, alertas festivos.
   - Guarda sesiones/mensajes y resumen para contexto.
   - Transcripcion de audio con OpenAI (whisper-1).
 
8) **Caja registradora**
   - Combina citas (precio final, incluye productos) + movimientos manuales.
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
- ImageKit: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_FOLDER`.
- Twilio: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_SID`, `TWILIO_ACCOUNT_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_TEMPLATE_SID`, `TWILIO_SMS_COST_USD` (opcional).
- Email: `EMAIL`, `PASSWORD`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM_NAME`.
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

## Seguridad, riesgos y casuisticas (checklist rapido)
- **Auth admin por JWT**: `Authorization: Bearer <Firebase ID Token>` verificado en backend.
- **Expiración JWT**: los ID tokens expiran y se renuevan en el cliente; manejar 401/403 y reintentos si aplica.
- **CORS**: habilitado global; revisar origenes en produccion.
- **Multi-tenant**: validar siempre `localId` en queries (ya se usa `getCurrentLocalId`).
- **Jobs cron**: iteran por marca/local para evitar usar `DEFAULT_LOCAL_ID` en multi-tenant.
- **Datos incompletos**: flows permiten `guestName`/`guestContact` sin userId.
- **Email/SMS**: si faltan credenciales, notificaciones se deshabilitan (log warn).
- **IA**: si no hay API key, el endpoint falla; manejar fallback.
- **ImageKit**: folder y credenciales deben estar presentes o falla firma/borrado.
- **Validaciones**: DTOs con class-validator, pero revisar payloads de admins.

## Puntos de fallo comunes (para debug rapido)
- Subdominio invalido: `TENANT_SUBDOMAIN_REQUIRED` o `TENANT_NOT_FOUND`.
- Sin `Authorization` (Bearer): endpoints admin devuelven 401/403.
- Precio de cita incorrecto: revisar ofertas activas y categoria/servicio.
- Slots vacios: revisar horario del barbero, festivos o duracion.
- No llegan recordatorios: revisar Twilio + `notificationPrefs` (sms/whatsapp) + preferencias del usuario.

## Principios de desarrollo continuo
- Mantener componentes/servicios pequenos y reutilizables.
- Evitar acoplamientos entre UI y API (usar `data/api.ts`).
- Documentar cambios en flujos criticos (citas, pricing, multi-tenant).
- Tests minimos para logica de scheduling, pricing y permisos.
