# ADR-0009: Post-Migration Boundary Enforcement (contexts/* sin imports a modules/*)

- Estado: Aprobado
- Fecha: 2026-03-05
- Relacionado con: ADR-0006, ADR-0008

## Contexto

Tras la migracion incremental a DDD + Hexagonal, los adapters puente que vivian en `contexts/*` y dependian de `modules/*` quedaron eliminados o movidos a los modulos dueños de la integracion.

El riesgo residual es la reintroduccion accidental de acoplamientos `contexts/* -> modules/*`, lo cual rompe:
- el aislamiento del core,
- los contratos por puertos (ACL),
- la evolucion independiente por bounded context.

## Decision

Se establece como regla dura:

1. `src/contexts/**` no puede importar nada de `src/modules/**`.
2. Los bridges de integracion legacy o de compatibilidad viven fuera de `contexts/*` (tipicamente en `modules/*/adapters`).
3. La verificacion se aplica en tres niveles:
   - `arch:check` bloquea imports invalidos.
   - inventario `context-module-bridges` se mantiene sincronizado y con `0` activos.
   - gates de CI/release exigen `enforce-zero` antes de evaluar smokes runtime.

## Consecuencias

- Positivas:
  - se mantiene la frontera Hexagonal de forma automatica;
  - menos drift arquitectonico entre PRs;
  - menor riesgo de regresion silenciosa en migraciones futuras.
- Costes:
  - mayor friccion al introducir cambios rapidos cross-layer;
  - necesidad de crear puertos/adapters explicitos para cualquier nueva integracion.

## Evidencia operativa

- Inventario actual: `docs/migration/context-module-bridges-inventory.md` reporta `Total imports detectados: 0`.
- Gate CI: `migration:gate:ci` exige `context-module-bridges:enforce-zero`.
- Gate release: `release-gate` ejecuta CI-guards previos (`arch`, `transition-artifacts`, `context-module-bridges`).
