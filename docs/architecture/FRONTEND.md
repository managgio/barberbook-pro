# Frontend

El frontend usa React 18, TypeScript, Vite, React Router, TanStack React Query, Tailwind y componentes shadcn/Radix.

## Responsabilidades

- `pages/`: composición de vistas y flujos.
- `components/`: UI reutilizable; extraer secciones cuando una página crece.
- `context/`: estado transversal de sesión, tenant, idioma y permisos.
- `data/api/`: contratos HTTP y acceso a backend.
- `data/types.ts`: modelos compartidos del cliente.
- `hooks/`: coordinación reutilizable.
- `lib/`: políticas puras y utilidades pequeñas.
- `i18n/locales/`: todo texto visible localizado.

## Estado y datos

- React Query es la fuente de verdad para estado servidor, con query keys que incluyan el local cuando corresponda.
- Context se reserva para sesión/configuración realmente transversal.
- Estado de formulario/UI permanece local.
- Después de mutaciones, invalida queries concretas o emite los eventos administrativos existentes; evita recargas globales.

## Autorización y rutas

La UI no concede permisos. `ProtectedRoute` mejora navegación, pero el backend sigue siendo autoritativo. Para decidir acceso admin del tenant usa `hasTenantAdminAccess(user)`. No uses `role === 'admin'` ni `isSuperAdmin` global como fallback.

Al cambiar de local se refresca el perfil tenant-scoped y se aíslan las queries. Un usuario admin de otro tenant debe navegar como cliente.

## Componentización

- Una página orquesta; los formularios complejos, paneles y diálogos viven en componentes/secciones dedicados.
- Las políticas calculables se extraen a funciones puras con tests.
- Evita efectos que duplican estado derivado y dependencias inestables.
- Mantén lazy loading en rutas pesadas y evita aumentar el chunk inicial.
- Las incidencias de notificaciones se componen en `components/notification-deliveries/`; la página tenant y Observabilidad de Platform reutilizan el mismo panel, tabla, tarjetas móviles y filtros por columna.

## UX, accesibilidad e i18n

- Labels, foco, teclado, estados de carga/error/vacío y contraste son obligatorios.
- Los grupos construidos con `TabsList` comparten un indicador deslizante accesible desde el componente base; no dupliques medición ni animación en cada página.
- Toda acción destructiva o masiva muestra impacto y confirmación.
- No introduzcas texto visible inline si existe infraestructura i18n.
- Actualiza al menos `es.json` y `en.json`, y ejecuta `npm run i18n:check`.
- Consulta [FRONTEND_I18N_COPY_CHECKLIST.md](../FRONTEND_I18N_COPY_CHECKLIST.md).
- Las acciones de factura de calendario, clientes y búsqueda reutilizan un único componente. La generación PDF se carga de forma diferida y compartir usa Web Share con descarga como fallback.
- La configuración fiscal del tenant solo se monta si Platform habilitó facturación. El selector de varios servicios sigue la misma jerarquía: capacidad de Platform y preferencia del tenant antes de cambiar el flujo público.
- La reserva de invitado ofrece recordatorios solo a partir de `notificationCapabilities` efectivas del bootstrap. Un único canal se presenta como consentimiento simple y varios como selección combinable; no existe alta implícita y cualquier selección exige teléfono. La prueba manual de SMS vive únicamente en Platform, se renderiza solo para administradores de plataforma en desarrollo local, usa el remitente global `MANAGGIO` y bloquea mensajes de más de tres segmentos tras calcular GSM-7 o UCS-2.
- El enlace firmado de una cita invitada abre la ruta pública lazy `/cita/:token`. La vista consume únicamente el resumen mínimo del backend, no muestra PII, trata token inválido y expirado como un mismo estado y solo ofrece cancelación cuando `canCancel` es verdadero, siempre con confirmación.
- La política global de `Referer` usa `origin`: permite al backend contrastar el tenant enviado por el cliente con el dominio público, pero nunca expone rutas ni tokens de enlaces de cita a recursos externos.
- Calendario, búsqueda, clientes y edición reutilizan la presentación de citas de `appointmentPresentation` y `AppointmentServiceSummary`: una cita múltiple se identifica como un único bloque, pero conserva desglose, orden, duración e importes por servicio. `Appointment.price` siempre se rotula como total de la cita para no confundirlo con el precio de una línea.
- La vista Platform del asistente IA es una ruta lazy y paginada. Sus filtros de periodo, origen y tenant se resuelven en servidor; el detalle diferencia visualmente texto, voz y plantilla sin descargar el historial completo en el listado.

## Rendimiento

- Conserva los budgets y mediciones de [PERF_BASELINE.md](../perf/PERF_BASELINE.md).
- Pagina listas, virtualiza cuando el volumen lo justifique y evita peticiones por elemento.
- Los historiales operativos filtran y paginan en servidor. Las opciones ligeras de tenant/local se cargan por un endpoint específico, sin reutilizar respuestas de configuración completas.
- Optimiza imágenes y no añadas dependencias grandes para una utilidad pequeña.

## Verificación mínima

- Tests Vitest de las políticas/componentes cambiados.
- `npm run test:run`
- `npm run lint`
- `npm run build`
- `npm run i18n:check` cuando aplique.
