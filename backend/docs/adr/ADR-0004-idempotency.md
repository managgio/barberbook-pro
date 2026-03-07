# ADR-0004: Idempotency Keys

- Status: Accepted
- Date: 2026-03-04

## Context
Endpoints write y jobs pueden reintentar por red, locks o conflictos transaccionales.

## Decision
- Idempotencia en capa `application`.
- Key base: `tenantId + capability + actor + clientRequestId`.
- Persistencia recomendada: tabla dedicada (`idempotency_key`) con estado, hash request, respuesta resumida, TTL.

## Consequences
- Evita side effects duplicados.
- Permite reintentos seguros.
- Requiere disciplina de key propagation desde adapters HTTP/jobs.
