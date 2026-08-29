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
