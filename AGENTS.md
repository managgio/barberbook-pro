# AGENTS.md - guía de entrada a Managgio

Este archivo es el punto de entrada obligatorio para cualquier agente o persona que modifique el repositorio. Su función es enrutar, no duplicar toda la arquitectura.

## Antes de cambiar código

1. Lee [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. Lee únicamente los documentos de la tabla que afecten a la tarea.
3. Revisa `git status --short` y conserva cualquier cambio ajeno.
4. Localiza contratos, pruebas y migraciones existentes antes de diseñar una solución.

| Si vas a tocar… | Lee también |
| --- | --- |
| NestJS, casos de uso, puertos o adapters | [Backend](docs/architecture/BACKEND.md) |
| Tenant, auth, permisos o Prisma con datos de negocio | [Tenancy y seguridad](docs/architecture/TENANCY_AND_SECURITY.md) |
| React, rutas, estado, React Query o i18n | [Frontend](docs/architecture/FRONTEND.md) |
| Citas, disponibilidad, festivos, comunicados o avisos | [Booking y engagement](docs/architecture/BOOKING_AND_ENGAGEMENT.md) |
| Prisma, migraciones, SMTP, Twilio, Firebase, Stripe o ImageKit | [Datos e integraciones](docs/architecture/DATA_AND_INTEGRATIONS.md) |
| Tests, rendimiento, Definition of Done o documentación | [Estándares de ingeniería](docs/ENGINEERING_STANDARDS.md) |
| Decisiones arquitectónicas históricas | [Índice ADR](backend/docs/adr/README.md) |

## Reglas no negociables

- El backend evoluciona hacia DDD + arquitectura hexagonal. El dominio y los casos de uso no dependen de Nest, Prisma ni SDKs.
- Todo dato de negocio se limita por el tenant del request. `brandId` y `localId` proceden del contexto resuelto, nunca del body como fuente de autoridad.
- `LocationStaff` es la autoridad para administrar un local. `User.role` e `isSuperAdmin` son campos globales/legacy y no conceden acceso transversal. Solo `isPlatformAdmin` puede cruzar tenants de forma explícita.
- Los endpoints, consultas, escrituras, cachés y claves de idempotencia deben conservar el aislamiento entre tenants.
- Las reservas deben validarse de nuevo dentro de la frontera transaccional. La disponibilidad mostrada al cliente nunca sustituye la comprobación final.
- En frontend, la autoridad viene del perfil tenant-scoped del backend; usa `hasTenantAdminAccess`, no comprobaciones directas de `role === 'admin'`.
- No introduzcas archivos gigantes. Extrae políticas, casos de uso, adapters y componentes por responsabilidad. Si un archivo empieza a mezclar orquestación, dominio e infraestructura, divídelo.
- No realices refactors laterales, cambios destructivos ni limpiezas ajenas a la tarea.
- Todo bug corregido requiere una prueba de regresión. Toda feature nueva requiere tests proporcionados al riesgo.
- Cambios de Prisma requieren `schema.prisma`, migración SQL versionada y regeneración del cliente.
- Nunca registres secretos ni PII innecesaria. En integraciones externas registra códigos seguros, tenant y correlation ID.
- En textos visibles, documentación, mensajes, logs y comentarios nuevos, evita el carácter Unicode U+2014. Usa el guion normal (-) o reformula la frase.
- Actualiza la documentación temática cuando cambie una regla o flujo descrito. Mantén este archivo y `ARCHITECTURE.md` como índices breves.

## Flujo de trabajo

1. Formula la invariante que debe mantenerse.
2. Identifica bounded context y capa propietaria.
3. Cambia el contrato mínimo y añade la regresión primero o junto al cambio.
4. Implementa de dentro hacia fuera: dominio/política → caso de uso → puerto → adapter/controller/UI.
5. Valida tenant scope, concurrencia, idempotencia, errores y observabilidad.
6. Ejecuta las pruebas afectadas y después los gates proporcionales al riesgo.
7. Revisa diff y estado final; documenta migraciones o pasos operativos pendientes.

## Comandos base

Backend, desde `backend/`:

- `npm run test:typecheck`
- `npm run test:changed`
- `npm run test:critical` para auth, booking, pagos o errores HTTP
- `npm run test:unit` / `npm run test:contract` según la capa
- `npm run build`
- `npm run arch:check`
- `npm run tenant:scope:check`
- `npm run test:policy`

Frontend, desde `frontend/`:

- `npm run test:run`
- `npm run lint`
- `npm run build`
- `npm run i18n:check` si cambia texto visible o traducciones

Consulta [backend/docs/testing/TESTING_STRATEGY.md](backend/docs/testing/TESTING_STRATEGY.md) para la matriz completa y [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) para el Definition of Done.
