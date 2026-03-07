# Backend Testing Strategy

## Objetivo

Asegurar calidad funcional, estabilidad de migración DDD+Hexagonal y velocidad de entrega con reglas automatizadas.

## Pirámide aplicada

- `unit`: invariantes de dominio y use cases.
- `contract`: puertos/adapters/facades y mapping de contratos.
- `parity`: equivalencia de comportamiento legacy vs core nuevo.
- `e2e-smoke`: validación runtime de endpoints críticos en entorno con datos reales.

## Comandos oficiales

- `npm test`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:parity`
- `npm run test:critical`
- `npm run test:coverage:gate`
- `npm run test:changed`
- `npm run test:advisor -- --phase=dev|push|pr`
- `npm run test:policy`
- `npm run test:e2e:smoke`

## Automatización y decisiones

- Selección afectada automática:
  - Script: `backend/scripts/tests/run-affected-tests.mjs`
  - Regla: si hay cambios globales (`shared/bootstrap/prisma/tenancy/app/main`), ejecuta suite completa.
  - Regla: si hay cambios por contexto, ejecuta `unit+contract+parity` del contexto afectado.

- Política de obligatoriedad de tests:
  - Script: `backend/scripts/tests/enforce-test-change-policy.mjs`
  - Falla si cambia `src/` sin cambios en `test/`.
  - Falla si hay nuevos archivos funcionales y no hay nuevos tests.

- Coverage gate:
  - Script: `backend/scripts/tests/coverage-gate.mjs`
  - Umbrales: `backend/test/coverage-thresholds.json`.

- E2E smoke runtime (opt-in):
  - Script: `backend/scripts/tests/run-optional-e2e-smoke.mjs`
  - Ejecuta solo con `TEST_E2E_SMOKE_ENABLED=true`.
  - Reutiliza `runtime-capability-smoke` y `runtime-authenticated-smoke`.
  - En CI (`backend-hardening.yml`) corre con MySQL dedicado por servicio (`mysql:8`) + `npm run ci:prepare:db` (wait/retry + `prisma:deploy` + `prisma:seed`).
  - Safety de seed destructivo:
    - `prisma/seed.ts` está bloqueado por defecto.
    - Solo permite truncado total con `ALLOW_DESTRUCTIVE_SEED=true` + `DESTRUCTIVE_SEED_CONFIRMATION=I_UNDERSTAND_DATA_LOSS`.
    - Además bloquea ejecución en entornos protegidos (`prod/staging/preprod/preview/qa`) y en hosts DB no locales.
    - `ci:prepare:db` está bloqueado fuera de CI salvo override explícito `ALLOW_LOCAL_CI_PREPARE_DB=true`.
  - CI ejecuta en modo estricto (`TEST_E2E_SMOKE_STRICT=true`) para exigir checks críticos de `auth` y `platform`.
  - `checkout` se puede exigir también con `TEST_E2E_SMOKE_REQUIRE_CHECKOUT=true` (requiere Stripe disponible en CI).

## Matriz crítica obligatoria (P0)

- `Auth/Firebase`:
  - Unit: `backend/test/unit/identity/auth-service-and-guards.test.ts`
  - Unit: `backend/test/unit/identity/firebase-admin-auth-dev-bypass.test.ts`
  - Smoke estricto: checks `auth.users.*`, `auth.admin.*`, `auth.platform.*`.
- `Booking/Appointments`:
  - Unit: `backend/test/unit/booking/booking-availability-engine.test.ts`
  - Unit: `backend/test/unit/booking/booking-get-availability.usecase.test.ts`
  - Unit: `backend/test/unit/booking/booking-create-appointment.usecase.test.ts`
  - Unit: `backend/test/unit/booking/booking-update-appointment.usecase.test.ts`
  - Unit: `backend/test/unit/booking/booking-remove-appointment.usecase.test.ts`
  - Contract: `backend/test/contract/booking/prisma-booking-availability-read.adapter.test.ts`
- `Payments/Stripe`:
  - Unit: `backend/test/unit/commerce/commerce-process-stripe-webhook.usecase.test.ts`
  - Contract: `backend/test/contract/commerce/commerce-stripe-payment-gateway.adapter.test.ts`
  - Smoke estricto: checks `auth.admin.payments.stripe.config`, `auth.payments.webhook.invalid-body`.
- `Errores HTTP de dominio`:
  - Unit: `backend/test/unit/shared/rethrow-domain-error-as-http.test.ts`

Si se toca cualquiera de estas capacidades, es obligatorio mantener/añadir tests en estos grupos.
Además, CI ejecuta `test:critical` como gate explícito de regresión.

## Avisos contextuales (manual + asistente)

- Comando de ayuda operativa:
  - `npm run test:advisor -- --phase=dev`
  - `npm run test:advisor -- --phase=push`
  - `npm run test:advisor -- --phase=pr`
- El advisor analiza el diff de backend y sugiere solo comandos necesarios para esa fase.
- Si no hay cambios en backend, el advisor no sugiere acciones manuales.
- El advisor también avisa cuando:
  - cambias `src/` sin tocar `test/`;
  - detecta archivos funcionales nuevos sin tests nuevos.

## Reglas de equipo (obligatorias)

- Cada feature nueva debe incluir tests.
- Cada bug fix debe incluir test de regresión.
- No se mergea PR con `test:policy`, `test:coverage:gate` o suites requeridas en rojo.
- Si se cambia contrato de un puerto/adapter/facade, test de `contract` obligatorio.
- Si se modifica flujo migrado desde legacy, test de `parity` obligatorio.

## Flujo recomendado por tipo de cambio

- Cambio en dominio/use case:
  - `npm run test:changed`
  - `npm run test:unit`

- Cambio en adapters/facades/integraciones:
  - `npm run test:changed`
  - `npm run test:contract`

- Cambio de comportamiento con equivalencia legacy/v2:
  - `npm run test:changed`
  - `npm run test:parity`

- Antes de merge:
  - `npm run test:ci`

## Operación manual mínima del equipo

Sí, hay tareas manuales, pero están pautadas:

- Durante desarrollo local:
  - ejecutar `npm run test:advisor -- --phase=dev` para decidir siguiente paso;
  - ejecutar `npm run test:changed` en cada bloque de cambios relevante;
  - ejecutar `npm run test:unit` siempre que toques dominio/use cases;
  - ejecutar `npm run test:contract` si tocas adapters/facades/integraciones;
  - ejecutar `npm run test:parity` si tocas equivalencia legacy/v2.

- Antes de push:
  - ejecutar `npm run test:advisor -- --phase=push`;
  - ejecutar los comandos sugeridos por advisor.

- Antes de abrir PR:
  - ejecutar `npm run test:advisor -- --phase=pr`;
  - ejecutar `npm run test:policy`;
  - ejecutar `npm run test:coverage:gate`;
  - ejecutar `npm run test:ci` si el cambio es amplio o crítico.

- Al crear funcionalidades nuevas:
  - obligatorio añadir tests nuevos (policy + checklist PR lo exige).

- Al corregir bugs:
  - obligatorio añadir al menos un test de regresión.
