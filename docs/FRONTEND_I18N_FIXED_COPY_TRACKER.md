# Frontend Fixed-Copy I18N Tracker

## Objetivo
Traducir textos fijos del producto (UI) por idioma tenant, de forma desacoplada, mantenible y extensible.

## Estado global
- Fase actual: `Fase 3.1 - Hardening QA cerrado`
- Última actualización: `2026-03-09 (iteración smoke tests i18n + checklist copy)`

## Fase 1 - Base y pantallas públicas (completada)
- [x] Crear capa i18n frontend (`messages`, `translateUi`, `useI18n`).
- [x] Conectar selector de idioma con placeholder traducible.
- [x] Traducir `Navbar` (acciones principales).
- [x] Traducir `LandingPage` (hero, servicios, productos, CTA, footer).
- [x] Traducir `AuthPage` (tabs, CTAs, mensajes y copy lateral).
- [x] Traducir `HoursLocationPage` (títulos, contacto, días y estado cerrado).
- [x] Traducir `ProfilePage` en secciones principales (toasts, cabeceras, idioma, notificaciones, fidelización base).

## Fase 2 - Extensión a paneles (cerrada)
- [x] Migrar textos fijos de vistas cliente restantes (`BookingWizard`, `AppointmentsPage`, `ClientDashboard`, `ReferralsPage`, `SubscriptionsPage`).
- [x] Migrar componentes compartidos del flujo cliente (`ClientLayout`, `ProductSelector`, `LoyaltyProgressPanel`, `AppointmentEditorDialog`).
- [x] Separar `messages.ts` en catálogo JSON por idioma (`locales/es.json`, `locales/en.json`) manteniendo API `translateUi`.
- [x] Migrar textos fijos críticos de panel admin (Dashboard, Calendar, Search, Clients, Settings) + navegación/layout admin.
- [x] Eliminar hardcodes `es` de fechas y toasts en vistas cliente migradas.
- [x] Hard-lock de Platform a español (`es`) para evitar influencia del selector tenant.
- [x] Migrar `QuickAppointmentButton` completo a i18n (`quickAppointment.*` + reutilización de `appointmentEditor.*`).
- [x] Migrar huecos restantes detectados en flujos activos:
  - `Landing` título de sección de staff.
  - `Profile` placeholders + bloque de preferencias + danger zone.
  - `LocationSwitcher` placeholder.
  - `AppointmentEditorDialog` grupo `Otros`.
  - fallbacks `staff eliminado` en `AdminCalendar`, `AdminSearch`, `AdminClients`.
  - ayudas informativas en `AdminDashboard`.
- [x] Migrar módulos admin adicionales:
  - `AdminHolidays` completo (`admin.holidays.*`).
  - `AdminRoles` completo (`admin.roles.*`).
  - `AdminOffers` completo (`admin.offers.*`).
  - `adminSections` con claves i18n (`admin.section.*`) para evitar descripciones fijas en español.
- [x] Migrar módulos admin de alto impacto:
  - `AdminCashRegister` completo (`admin.cashRegister.*`) con locale de fecha y moneda por idioma.
  - `AdminServices` completo (`admin.services.*`) incluyendo toasts, diálogos, categorías y acciones.
- [x] Migrar módulos admin de continuidad:
  - `AdminSubscriptions` completo (`admin.subscriptions.*`) incluyendo planes, asignaciones, estados/pagos e historial.
  - `AdminBarbers` completo (`admin.barbers.*`) incluyendo perfil, asignaciones por servicio, horarios y tolerancias.
- [x] Cerrar módulos admin restantes:
  - `AdminStock`, `AdminReferrals`, `AdminLoyalty`, `AdminReviews`, `AdminAlerts`, `AdminAiAssistant`, `AdminSettings`, `AdminSpotlight` y componentes admin asociados.
- [x] Cerrar componentes/páginas públicas y soporte:
  - `GuestBookingPage`, `ReferralLandingPage`, `ReviewPromptModal`, `AppointmentStatusPicker`, `AuthSessionMonitor`, `NetworkStatusMonitor`, `AppErrorBoundary`, `TenantError`, `LegalFooter`, `LegalPage`, `NotFound`.
- [x] Completar catálogo `es/en` para todas las claves i18n usadas en runtime (`t('...')`).

## Fase 3 - Endurecimiento y cobertura
- [x] Añadir guardrail automatizado de cobertura i18n:
  - script `frontend/scripts/i18n-key-coverage.mjs`
  - comando `npm --prefix frontend run i18n:check`
  - validación de claves runtime en `es/en` + paridad de placeholders.
- [x] Integrar validación en ciclo de desarrollo con `lint + build + i18n:check`.
- [x] Añadir smoke tests frontend de idioma tenant (`LanguageProvider`, `LanguageSelector`, `language utils`) con Vitest.
- [x] Exponer script dedicado `npm --prefix frontend run test:smoke:i18n`.
- [x] Definir checklist de revisión de copy final (tono y consistencia) por dominio para futuras pantallas (`docs/FRONTEND_I18N_COPY_CHECKLIST.md`).

## Último punto completado
- Hardening QA de i18n frontend:
  - smoke tests añadidos (`language.test.ts`, `LanguageSelector.test.tsx`, `LanguageContext.test.tsx`),
  - script `test:smoke:i18n` integrado en `package.json`,
  - checklist operativa de revisión de copy i18n añadida,
  - hardcode residual de toasts en `AdminPermissionsContext` migrado a keys i18n.
  - validación en verde: `test:smoke:i18n`, `i18n:check`, `lint`, `build`.

## Nota de continuidad (dinámico)
- Fuera del scope fixed-copy, se añadió control UI de traducciones dinámicas mediante `LocalizationManagerDialog` en `AdminServices`, `AdminStock`, `AdminAlerts` y `AdminSettings` (estado por idioma, edición manual, lock manual y regeneración), más badge visible de estado por entidad en listados (`LocalizationStatusBadge`), documentado en `backend/docs/I18N_MULTILANGUAGE_TRACKER.md`.

## Siguiente tarea inmediata
- Backlog opcional: sumar Playwright para smoke visual browser-level (footer selector + perfil + navegación).
