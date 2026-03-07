# ADR-0001: CQRS Pragmatico

- Status: Accepted
- Date: 2026-03-04

## Context
Necesitamos separar casos de uso sin sobre-ingenieria en un monolito modular.

## Decision
- `commands` para cambios de estado (write path) con reglas de dominio.
- `queries` finas para lecturas (read path) priorizando performance y claridad.
- Se permite query directa a adapters read sin crear agregado cuando no hay invariantes.

## Consequences
- Menor acoplamiento entre lecturas y escrituras.
- Evitamos duplicar modelo de dominio en consultas simples.
- Mantiene trazabilidad de comportamiento critico en writes.
