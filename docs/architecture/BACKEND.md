# Backend

## Dirección arquitectónica

El backend usa NestJS como delivery/composición y avanza hacia DDD + arquitectura hexagonal. La regla de dependencias es:

```text
controller / scheduler
        ↓
application use case
        ↓
domain policy / entity / value object
        ↓
outbound port ← infrastructure adapter (Prisma, SDK, legacy facade)
```

El dominio no importa NestJS, Prisma, DTO HTTP ni SDKs. Los casos de uso reciben comandos/queries y puertos; los módulos Nest ensamblan implementaciones.

## Organización de un contexto

- `domain/entities`, `domain/value-objects`, `domain/services`: invariantes puras.
- `application/commands`, `application/queries`: contratos de intención.
- `application/use-cases`: orquestación de una responsabilidad.
- `ports/outbound`: necesidades del caso de uso, definidas por el consumidor.
- `infrastructure/prisma` o `infrastructure/adapters`: detalles externos.
- `modules/*`: controllers, DTOs, guards y puentes legacy durante la migración.

Evita servicios “god object”. Separa cálculo puro, autorización, persistencia y transporte. Un controller no decide reglas de negocio y un adapter no inventa políticas.

## CQRS pragmático

No se exige un bus. Se separan comandos y queries por intención y contratos. Las lecturas pueden usar proyecciones eficientes; las escrituras preservan invariantes y fronteras transaccionales.

## Transacciones, locks e idempotencia

- La creación/edición de reservas vuelve a comprobar disponibilidad dentro de la operación protegida.
- Los flujos susceptibles a doble ejecución usan claves de idempotencia y/o `DistributedLockPort`.
- Las transacciones viven en application/infrastructure, no dentro de entidades puras.
- No se realizan llamadas externas largas dentro de una transacción DB salvo decisión explícita.
- Consulta [ADR-0002](../../backend/docs/adr/ADR-0002-transaction-boundary.md), [ADR-0003](../../backend/docs/adr/ADR-0003-domain-events-outbox.md) y [ADR-0004](../../backend/docs/adr/ADR-0004-idempotency.md).

## Errores y contratos HTTP

- DTOs con `class-validator` en el borde.
- Errores de dominio tipados y mapeados centralmente a HTTP.
- No filtrar mensajes internos, SQL, tokens o secretos.
- Los códigos/mensajes públicos deben ser estables cuando el frontend dependa de ellos.

## Consultas y rendimiento

- Selecciona solo campos necesarios y limita listas/paginación.
- Todo acceso a entidades tenant-scoped incluye `localId` o `brandId` en el `where` apropiado.
- Diseña índices siguiendo filtros, orden y cardinalidad reales.
- Evita N+1, consultas en bucles y cargas de relaciones completas.
- Los jobs deben procesar lotes acotados, ser reentrantes y conservar tenant context.

## Puentes legacy

Los facades y adapters legacy son fronteras de transición. La lógica nueva debe entrar en el contexto propietario. No crees dependencias directas entre implementaciones de contextos; usa ports/ACL según [ADR-0006](../../backend/docs/adr/ADR-0006-cross-context-contracts.md).

## Verificación mínima

- `npm run test:typecheck`
- `npm run test:changed`
- `npm run arch:check`
- `npm run tenant:scope:check`
- unit tests para dominio/use cases; contract tests para adapters/facades.
