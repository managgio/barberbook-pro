# ADR-0002: Transaction Boundary en Application + SERIALIZABLE

- Status: Accepted
- Date: 2026-03-04

## Context
`appointments` write path tiene invariantes concurrentes (no overlap, stock holds, ledger).

## Decision
- La transaccion se abre/cierra en `application` via `UnitOfWorkPort`.
- Aislamiento por defecto para booking write: `SERIALIZABLE`.
- `domain` no conoce transacciones.

## Consequences
- Reglas de consistencia centralizadas por caso de uso.
- Menor riesgo de race conditions en booking.
- Posible retry en conflictos `P2034` (controlado por application).
