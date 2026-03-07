# ADR-0005: RequestContext Final + ClockPort

- Status: Accepted
- Date: 2026-03-04

## Context
El core no debe depender de ALS/Nest para resolver tenant o tiempo.

## Decision
`RequestContext` objetivo:
- `tenantId`
- `brandId`
- `localId`
- `actorUserId`
- `timezone`
- `correlationId`

Y `ClockPort` en shared para controlar tiempo en domain/application.

## Consequences
- Mejor testabilidad y trazabilidad.
- Menor acoplamiento al framework.
- Requiere mapping explicito en adapters.
