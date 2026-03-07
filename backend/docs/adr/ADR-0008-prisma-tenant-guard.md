# ADR-0008: Prisma Tenant Guard como Defensa en Profundidad

- Status: Accepted
- Date: 2026-03-04

## Context
Aunque el core propague `RequestContext`, sigue habiendo riesgo de query sin scope.

## Decision
- Mantener guard runtime tenant-scope de Prisma.
- Mantener script de chequeo tenant-scope en CI.
- El guard no reemplaza `RequestContext`; lo complementa.

## Consequences
- Capa extra contra fugas cross-tenant.
- Reduce impacto de errores humanos durante migracion.
- Agrega verificaciones operativas pero con alto valor de seguridad.
