# Estándares de ingeniería

## Diseño y mantenibilidad

- Una unidad de código tiene una responsabilidad y un propietario arquitectónico claro.
- Prefiere composición y funciones puras a condicionales repetidos.
- No dupliques políticas de autorización, fechas o disponibilidad; crea una única fuente de verdad.
- Divide archivos cuando mezclen capas o varios flujos independientes. El número de líneas es una señal, no el único criterio.
- Nombres expresan intención de negocio. Comentarios explican el porqué, no reescriben el código.
- No añadas abstracciones especulativas: extrae cuando existe una frontera real o una prueba que la justifica.

## Seguridad y robustez

- Valida entrada, ownership tenant y permisos en backend.
- Diseña reintentos idempotentes y estados parciales explícitos.
- Considera carreras, cambios de estado entre preview/confirmación y fallos del proveedor.
- No ocultes errores operativos: clasifícalos y deja trazabilidad segura.
- Ningún secreto o PII innecesaria en logs, fixtures o snapshots.

## Política de tests

La estrategia canónica está en [backend/docs/testing/TESTING_STRATEGY.md](../backend/docs/testing/TESTING_STRATEGY.md).

- Unit: dominio, políticas y casos de uso.
- Contract: adapters, facades y mappings.
- Parity: equivalencia durante migración legacy.
- E2E smoke: rutas críticas con runtime y DB.
- Bugfix: al menos una regresión que falle sin el arreglo.
- Auth, booking y pagos son P0 y ejecutan la matriz crítica.

Durante desarrollo usa `npm run test:advisor -- --phase=dev` y `npm run test:changed`. Antes de PR, ejecuta policy/coverage y suites sugeridas. El frontend usa Vitest y debe cubrir políticas puras y comportamiento relevante, no detalles de implementación.

## Rendimiento

- Consulta y renderiza solo lo necesario.
- Pagina y limita operaciones masivas.
- Alinea índices con filtros; inspecciona planes cuando haya riesgo.
- Evita N+1 y serialización de payloads grandes.
- Mantén lazy loading y budgets frontend de [perf/PERF_BASELINE.md](perf/PERF_BASELINE.md).

## Documentación

- `AGENTS.md` enruta y contiene reglas globales breves.
- `ARCHITECTURE.md` mantiene el mapa, no todos los detalles.
- La regla detallada vive en el documento temático propietario.
- ADR para decisiones difíciles de revertir o con alternativas relevantes.
- Las rutas/documentos se actualizan en el mismo cambio que altera su verdad.
- En contenido nuevo evita el carácter Unicode U+2014. Usa el guion normal (-) o reformula la frase para mantener un estilo natural y consistente.

## Definition of Done

- [ ] El cambio respeta el bounded context y la dirección de dependencias.
- [ ] Scope tenant y permisos comprobados, incluida una prueba negativa si es sensible.
- [ ] Migración e índices incluidos si cambia el modelo.
- [ ] Casos felices, bordes y regresiones cubiertos.
- [ ] Typecheck, tests afectados, build y gates de arquitectura/tenant en verde.
- [ ] UI con carga/error/vacío, accesibilidad e i18n cuando aplica.
- [ ] Logs/errores sin secretos ni PII.
- [ ] Documentación temática actualizada.
- [ ] Diff revisado sin cambios laterales ni archivos generados accidentales.

Las excepciones deben documentar motivo, riesgo, mitigación, owner y fecha/condición de retirada.
