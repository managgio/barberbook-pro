# ADR-0006: Cross-Context Contracts via Ports/ACL

- Status: Accepted
- Date: 2026-03-04

## Context
Booking depende funcionalmente de Commerce, pero no debe importar internals de otro contexto.

## Decision
- Dependencias cross-context solo via ports/ACL.
- Prohibido importar `contexts/<otro>/domain|application` internos.
- Contratos publicos versionables y estables.

## Consequences
- Menor acoplamiento y migracion mas segura.
- Claridad de ownership por bounded context.
- Requiere adapters de traduccion cuando cambien modelos.
