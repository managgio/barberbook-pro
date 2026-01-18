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
- `TenantConfigService` combina configuracion de marca y de local (JSON) y expone config publica (branding/theme/adminSidebar).

**Frontend**
- `TenantProvider` llama `GET /api/tenant/bootstrap`.
- Guarda `localId` en localStorage (`managgio.localId`).
- Aplica theme por marca/local (`theme.primary`) y overrides para plataforma.
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
- **Offers**: ofertas con descuentos (por servicios, categorias o global).
- **Appointments**: CRUD citas, disponibilidad, estados y pricing final.
- **Schedules**: horario del local y horarios por barbero (JSON).
- **Holidays**: festivos del local y por barbero.
- **Alerts**: banners/avisos con rango de fechas.
- **Settings**: configuracion del sitio (branding/contacto/horarios/sociales).
- **ImageKit**: firma y borrado de archivos.
- **Notifications**: emails + SMS de recordatorio.
- **AI Assistant**: chat/admin con tools y transcripcion.
- **Platform Admin**: gestion de marcas, locales y configuracion global.

Seguridad actual (importante):
- Endpoints admin se validan via `x-admin-user-id` (no hay JWT en backend).
- `PlatformAdminGuard` exige `user.isPlatformAdmin`.
- `AiAssistantGuard` restringe a admins del local/plataforma.

## Arquitectura frontend
Entradas y layouts:
- Router por tenant: plataforma vs cliente.
- Layouts: `ClientLayout`, `AdminLayout`, `PlatformLayout`.
- Protecciones: `ProtectedRoute` por rol y plataforma.

Contextos principales:
- **AuthContext**: autentica con Firebase, sincroniza usuario con backend y guarda `managgio.adminUserId`.
- **TenantContext**: carga tenant y configura theme.
- **AdminPermissionsContext**: permisos por rol (AdminRole + adminSidebar oculto por config).

Paginas clave:
- Publicas: Landing, Auth, Guest Booking, Hours/Location.
- Cliente: Dashboard, Booking Wizard, Appointments, Profile.
- Admin: Dashboard, Calendar, Search, Clients, Services, Barbers, Alerts, Holidays, Roles, Settings.
- Plataforma: Dashboard, Brands (gestion multi-tenant).

## Modelo de datos (Prisma / MySQL)
Tabla | Para que existe | Que guarda
---|---|---
User | Identidad y perfil | Datos del usuario, rol, preferencias, firebaseUid, flags admin
Brand | Marca/cliente | Subdominio, dominio custom, estado y local por defecto
Location | Local/sucursal | Relacion con Brand, nombre, slug, estado
AdminRole | Rol admin por local | Permisos por seccion (JSON)
BrandUser | Membresia marca-usuario | Vinculo usuario <-> marca
LocationStaff | Staff local | Vinculo usuario <-> local y rol admin
BrandConfig | Configuracion por marca | JSON (branding, theme, twilio, email, imagekit, ai, etc)
LocationConfig | Configuracion por local | JSON (theme, imagekit folder, adminSidebar)
Barber | Profesional | Datos, rol, disponibilidad, foto, userId asociado
Service | Servicio | Precio, duracion, categoria
ServiceCategory | Categoria | Orden y descripcion de servicios
Offer | Ofertas | Descuento por scope (all/categories/services)
Appointment | Cita | Cliente, barbero, servicio, fecha, precio final, estado
Alert | Avisos | Mensajes con tipo y rango de fechas
GeneralHoliday | Festivo general | Rangos de cierre del local
BarberHoliday | Festivo de barbero | Rangos por barbero
ShopSchedule | Horario local | JSON con turnos diarios
BarberSchedule | Horario barbero | JSON con turnos diarios
SiteSettings | Configuracion sitio | JSON con branding, contacto, horarios, stats, etc
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
   - Se guarda `x-admin-user-id` en localStorage para endpoints admin.

3) **Disponibilidad de citas**
   - Se calcula por horario del barbero + horario local.
   - Se excluyen festivos (local y por barbero).
   - Slots por intervalos de 15 min y duracion de servicio.

4) **Pricing y ofertas**
   - Price base del servicio.
   - Se aplica la mejor oferta activa (rango de fechas).
   - Se guarda `price` final en Appointment.

5) **Notificaciones**
   - Email: al crear/actualizar/cancelar cita (SMTP via Nodemailer).
   - SMS: recordatorio 24h antes (Twilio), respeta `notificationWhatsapp`.

6) **Sincronizacion de estados**
   - Job cron cada 5 min marca citas completadas cuando pasa el fin + grace.
   - Job cron de recordatorios envia SMS y marca `reminderSent`.

7) **Asistente IA**
   - `/api/admin/ai-assistant/chat` con tools para crear citas y festivos.
   - Guarda sesiones/mensajes y resumen para contexto.
   - Transcripcion de audio con OpenAI (whisper-1).

## Integraciones externas
- **ImageKit**: firma y subida de imagenes. Carpetas por marca/local.
- **Twilio**: SMS 24h antes de la cita.
- **Firebase**: Auth en frontend + Admin SDK en backend (borrado usuario).
- **OpenAI**: chat + transcripcion para asistente admin.
- **SMTP (Nodemailer)**: emails transaccionales.
- **Google Maps**: URLs guardadas en SiteSettings para ubicacion.

## Configuracion por entorno (resumen)
Backend (`backend/.env`):
- DB: `DATABASE_URL`.
- Tenant defaults: `DEFAULT_BRAND_ID`, `DEFAULT_LOCAL_ID`, `DEFAULT_BRAND_SUBDOMAIN`, `TENANT_BASE_DOMAIN`, `PLATFORM_SUBDOMAIN`, `TENANT_REQUIRE_SUBDOMAIN`, `PLATFORM_ADMIN_EMAILS`.
- ImageKit: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_FOLDER`.
- Twilio: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_SID`, `TWILIO_ACCOUNT_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`.
- Email: `EMAIL`, `PASSWORD`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM_NAME`.
- AI: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE`, `AI_TRANSCRIPTION_MODEL`.
- Firebase Admin: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.
- Legal: `IP_HASH_SALT` (hash IP para consentimientos).

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
- **Auth admin por header**: `x-admin-user-id` es facil de falsear si se expone sin autenticacion real.
- **TODO JWT**: migrar a tokens firmados (JWT) con expiracion y refresh, manteniendo compatibilidad temporal con header.
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
- Sin `x-admin-user-id`: endpoints admin devuelven 401/403.
- Precio de cita incorrecto: revisar ofertas activas y categoria/servicio.
- Slots vacios: revisar horario del barbero, festivos o duracion.
- No llegan recordatorios: revisar Twilio + `notificationWhatsapp`.

## Principios de desarrollo continuo
- Mantener componentes/servicios pequenos y reutilizables.
- Evitar acoplamientos entre UI y API (usar `data/api.ts`).
- Documentar cambios en flujos criticos (citas, pricing, multi-tenant).
- Tests minimos para logica de scheduling, pricing y permisos.
