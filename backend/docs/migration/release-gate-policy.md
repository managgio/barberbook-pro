# Release Gate Policy (Staging / Canary / Prod)

## Objetivo
Definir cuándo y cómo se ejecuta `migration:gate:release` en cada entorno,
y cómo hacer rollback operacional inmediato sin bloquear despliegues críticos.

## Activación por Entorno

| Entorno | Comando recomendado | Bloqueante | Perfil |
|---|---|---|---|
| staging | `npm run migration:gate:release:staging` | sí | `staging` |
| canary | `npm run migration:gate:release:canary` | sí | `canary` |
| prod (pre-cutover) | `npm run migration:gate:release:prod` | sí | `prod` |
| local dev | `npm run migration:gate:release` | no (skip por defecto) | `custom` |

Atajos optimizados (post `migration:gate:ci`):
- `migration:gate:release:staging:fast`
- `migration:gate:release:canary:fast`
- `migration:gate:release:prod:fast`
- `migration:gate:release:canary-prod` (canary+prod con un solo `build+preflight`)

Nota: los comandos `*:fast` asumen `build` y `runtime:preflight` ya ejecutados en el mismo job.

## Defaults de Perfil

Los perfiles se resuelven en [release-gate.mjs](/Users/carlos/Projects/managgio/app/backend/scripts/migration/release-gate.mjs):

- `staging`:
  - `checks=runtime,auth`
  - `minPassRate=1.0`
  - `maxFailedChecks=0`
  - `requireStripeCheckoutCoverage=false`
  - `includeCiGuards=true` (arch + transition artifacts + context-module bridges en modo enforce-zero)
  - `enabled=true`
- `canary`:
  - `checks=runtime,auth`
  - `minPassRate=1.0`
  - `maxFailedChecks=0`
  - `requireStripeCheckoutCoverage=true`
  - `includeCiGuards=true` (arch + transition artifacts + context-module bridges en modo enforce-zero)
  - `enabled=true`
- `prod`:
  - `checks=runtime,auth`
  - `minPassRate=1.0`
  - `maxFailedChecks=0`
  - `requireStripeCheckoutCoverage=true`
  - `includeCiGuards=true` (arch + transition artifacts + context-module bridges en modo enforce-zero)
  - `enabled=true`

Se pueden sobreescribir con env vars:
- `MIGRATION_RELEASE_GATE_ENABLED`
- `MIGRATION_RELEASE_GATE_CHECKS`
- `MIGRATION_RELEASE_GATE_MIN_PASS_RATE`
- `MIGRATION_RELEASE_GATE_MAX_FAILED_CHECKS`
- `MIGRATION_RELEASE_GATE_PROFILE`
- `MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT`
- `MIGRATION_RELEASE_GATE_MIN_CHECKOUT_NON_SKIP`
- `MIGRATION_RELEASE_GATE_INCLUDE_CI_GUARDS`

## Cobertura checkout (PR24-F)

Cuando `MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT=true`, el gate exige:
- smoke `runtime` y `auth` sin `SKIP` en `payments.checkout.valid`,
- resumen estructurado en ambos smokes (`[migration:smoke:summary]`),
- `nonSkipCount >= MIGRATION_RELEASE_GATE_MIN_CHECKOUT_NON_SKIP` (por defecto = número de checks runtime/auth seleccionados).

Si Stripe no está operativo y el entorno exige cobertura, el gate falla explícitamente.

## Precondiciones Canary/Prod

Para `canary` y `prod` (donde `requireStripeCheckoutCoverage=true`) se requiere:
- configuración Stripe activa a nivel marca y local (`brandEnabled/localEnabled/platformEnabled`),
- `accountId` conectado en el local efectivo del smoke,
- cuenta Stripe con estado operativo (`chargesEnabled=true` y `detailsSubmitted=true`).

Si alguna de estas condiciones no se cumple, `payments.checkout.valid` quedará en `SKIP` y el gate fallará por cobertura.

## Nota sobre paridad legacy

- El smoke de paridad `legacy vs v2` queda retirado del gate por perfil desde PR36-A porque el modo `legacy` de booking fue eliminado en PR35-D.
- Puede ejecutarse manualmente para trazabilidad histórica, pero no es criterio bloqueante de release en la fase post-migración.

## Guardrails previos del gate (PR35-B)

Cuando `MIGRATION_RELEASE_GATE_INCLUDE_CI_GUARDS=true` (default en perfiles `staging/canary/prod`), el gate ejecuta primero:
- `arch:check`
- `transition-artifacts` en modo `--check --require-zero-present`
- `context-module-bridges` en modo `--check --require-zero-present`

Si alguno falla, el gate corta antes de los smokes runtime.

## Política de Rollback Operacional

Rollback inmediato (sin tocar código):
1. Desactivar gate en el job/pipeline afectado:
   - `MIGRATION_RELEASE_GATE_ENABLED=false`
2. Re-ejecutar pipeline con gate desactivado.
3. Crear incidencia operativa y adjuntar salida del gate fallido.
4. Abrir fix PR y reactivar gate al cerrar la incidencia.

Rollback por severidad:
1. Si falla `runtime`: bloquear promoción (infra o arranque inestable).
2. Si falla `auth`: bloquear promoción (riesgo de acceso/flujo principal).
3. Si el fallo es por dependencia externa no disponible (ej. Stripe no habilitado en tenant de prueba):
   - usar tenant canario con integración activa,
   - o desactivar temporalmente la exigencia de cobertura con `MIGRATION_RELEASE_GATE_REQUIRE_STRIPE_CHECKOUT=false` documentando excepción.

## Evidencia mínima por ejecución
Guardar en logs de pipeline:
- resumen del gate (`total/passed/failed/passRate`),
- checks fallidos,
- perfil usado (`profile=`),
- timestamp y commit SHA.

## Baseline de mantenimiento (PR37-A)

- Comando recomendado para baseline post-migración:
  - `npm run migration:baseline:maintenance`
- Qué valida:
  - fronteras de arquitectura (`arch` + inventarios en cero),
  - `build + runtime:preflight`,
  - gate de release perfil `staging` con checks operativos (`runtime,auth`) en modo `fast` (sin repetir CI-guards).
