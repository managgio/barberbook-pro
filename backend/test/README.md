# Backend tests

Organizacion oficial de tests del backend:

- `test/unit/<context>/`: pruebas unitarias de dominio y application (use cases/policies/helpers).
- `test/contract/<context>/`: pruebas de contrato de adapters/facades (puertos y puentes con legacy o SDKs simulados).
- `test/parity/<context>/`: pruebas de paridad y caracterizacion (legacy vs nuevo comportamiento).
- `test/e2e/`: reservado para pruebas end-to-end reales (HTTP + Nest bootstrap + DB/integraciones); actualmente sin suite activa.

`<context>` sigue bounded contexts:

- `booking`
- `commerce`
- `engagement`
- `identity`
- `platform`
- `ai-orchestration`
- `shared` (solo si no encaja en un contexto)

## Comandos

- `npm test`: ejecuta toda la suite.
- `npm run test:unit`: ejecuta solo unit tests.
- `npm run test:contract`: ejecuta solo contract tests.
- `npm run test:parity`: ejecuta solo parity tests.
- `npm run test:coverage:gate`: ejecuta coverage y valida umbrales (`test/coverage-thresholds.json`).
- `npm run test:changed`: ejecuta tests afectados por los archivos modificados.
- `npm run test:changed:list`: muestra la selección afectada sin ejecutar.
- `npm run test:advisor -- --phase=dev|push|pr`: sugiere comandos manuales según fase y diff detectado.
- `npm run test:policy`: valida reglas de obligatoriedad de tests por cambio de código.
- `npm run test:e2e:smoke`: ejecuta runtime e2e smoke solo si `TEST_E2E_SMOKE_ENABLED=true`.
  - modo estricto: `TEST_E2E_SMOKE_STRICT=true` (en CI está activo).
  - exigir checkout Stripe: `TEST_E2E_SMOKE_REQUIRE_CHECKOUT=true`.

## Criterios de ubicacion

- Si valida invariantes/politicas/use cases sin infraestructura real -> `unit`.
- Si valida mapping/delegacion de adapter o facade contra puerto/dependencias fake -> `contract`.
- Si compara resultado legacy vs v2 o asegura equivalencia de soporte -> `parity`.
- Si levanta app Nest completa y prueba rutas HTTP reales -> `e2e`.

## Reglas de trabajo

- Cambio en `src/` sin cambio en `test/` incumple política (`npm run test:policy`).
- Cambio de comportamiento (feature o bugfix) requiere tests nuevos o actualizados.
- Antes de `push` o abrir PR, ejecutar `npm run test:advisor -- --phase=push|pr` para recibir recordatorios contextuales de comandos.
- Flujo profesional recomendado en local:
  - `npm run test:changed`
  - `npm run test:unit`
  - `npm run test:contract` (si tocaste adapters/facades)
  - `npm run test:parity` (si tocaste equivalencias legacy/v2)
