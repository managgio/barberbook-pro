# ADR-0003: Domain Events Sync Ahora + Outbox Despues

- Status: Accepted
- Date: 2026-03-04

## Context
Necesitamos migrar incrementalmente sin rehacer infraestructura de eventos de golpe.

## Decision
- Fase inicial: handlers sincronos en el mismo proceso para side effects.
- Introducir Outbox cuando write path de Booking+Commerce este estable (target: despues de Fase 5).

## Consequences
- Entrega mas rapida en primeras fases.
- Riesgo controlado de acoplamiento temporal en side effects.
- Plan claro para evolucionar a entrega fiable asincrona.
