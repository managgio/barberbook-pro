# ADR-0007: Aggregate Boundaries

- Status: Accepted
- Date: 2026-03-04

## Context
No toda logica de disponibilidad debe persistirse como agregado.

## Decision
- `Appointment` es agregado persistente principal de Booking.
- `Availability` se modela como domain service + value objects.
- Reglas de solape/buffer/festivos viven en dominio puro.

## Consequences
- Modelo mas simple y alineado con uso real.
- Evita sobrecargar persistencia con entidades derivadas.
- Facilita pruebas unitarias de invariantes.
