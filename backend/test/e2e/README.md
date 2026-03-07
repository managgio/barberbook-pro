# E2E tests

Carpeta reservada para pruebas end-to-end reales del backend.

Al añadir las primeras E2E:

- bootstrap de `INestApplication` y rutas HTTP reales;
- entorno de datos controlado (fixture o base efimera);
- contrato de smoke critico (auth, tenant bootstrap, booking happy path).

Comando runtime smoke actual:

- `npm run test:e2e:smoke`
- por defecto hace `SKIP`; para ejecutar de verdad usar `TEST_E2E_SMOKE_ENABLED=true`.
- En CI backend (`.github/workflows/backend-hardening.yml`) se ejecuta con `TEST_E2E_SMOKE_ENABLED=true` y MySQL dedicado.
