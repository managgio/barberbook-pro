# Tenancy y seguridad

La separación entre tenants es una invariante de privacidad, no una convención de UI.

## Resolución de tenant

El middleware de tenancy resuelve marca y local a partir del host/subdominio permitido y guarda el contexto en AsyncLocalStorage mediante `TenantContextPort`. El contexto incluye, como mínimo, `brandId`, `localId`, zona horaria y correlation ID.

- En producción no se confía en headers de override salvo configuración explícita y controlada.
- Controllers y casos de uso no aceptan `localId` del cliente como autoridad.
- Jobs y schedulers deben reconstruir un contexto por tenant antes de ejecutar.

## Modelo de acceso

- `BrandUser`: membresía y bloqueo dentro de una marca.
- `LocationStaff`: autoridad de administración para un local y rol administrativo opcional.
- `AdminRole`: permisos granulares dentro del local.
- `User.role` e `User.isSuperAdmin`: columnas globales legacy; no conceden acceso a otro tenant.
- `User.isPlatformAdmin`: excepción global deliberada, protegida por `PlatformAdminGuard`.

Un usuario puede ser administrador en A y cliente normal en B. Todos los guards y casos de uso administrativos deben exigir `LocationStaff(localId, userId)`, salvo el administrador de plataforma. En frontend se usa `hasTenantAdminAccess`, basado en el perfil del local actual.

El correo de superadmin de marca debe proceder de la configuración explícita de esa marca. La variable `SUPER_ADMIN_EMAIL` solo es fallback del tenant legacy definido por `DEFAULT_BRAND_ID`; nunca se propaga a todas las marcas.

## Reglas Prisma

- Lecturas y escrituras incluyen el scope tenant en la misma consulta cuando sea posible.
- Antes de relacionar IDs externos (profesional, servicio, cita), se verifica que pertenezcan al local.
- Las relaciones globales solo se consultan sin scope cuando existe una razón documentada (`tenant-scope-ignore`).
- Ejecuta `npm run tenant:scope:check` y consulta [ADR-0008](../../backend/docs/adr/ADR-0008-prisma-tenant-guard.md).

## Cachés e integraciones

Una caché de configuración o cliente externo se clavea al menos por `brandId:localId` si existen overrides locales. Si contiene credenciales, incluye una huella segura de configuración para renovarse cuando cambien, sin almacenar el secreto en logs o claves visibles.

## Checklist de seguridad

- ¿La autorización se comprueba en backend y en cada ruta sensible?
- ¿El objeto consultado pertenece al tenant actual?
- ¿Un ID de otro tenant devuelve denegación/not found sin filtrar datos?
- ¿La caché, lock e idempotency key incluyen scope suficiente?
- ¿Los errores y auditorías omiten secretos/PII?
- ¿Existe una prueba donde un admin de tenant A intenta operar en tenant B?
- ¿Los administradores de plataforma son la única excepción transversal?

Los cambios de auth/tenancy son P0: requieren pruebas de regresión y `npm run test:critical`.
