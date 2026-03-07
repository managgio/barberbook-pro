Nest bootstrap composition lives here.

Boundary rules:
- `bootstrap/nest/*` wires delivery concerns (global middleware, guards, pipes, app composition).
- `tenancy/*` keeps tenant resolution/domain-independent infrastructure primitives.
- `contexts/*` exposes ports/adapters consumed by bootstrap and modules.

Current adapters moved here:
- Global middleware adapter: [tenant-context.middleware.ts](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/middleware/tenant-context.middleware.ts)
- Global guard adapter: [admin-global.guard.ts](/Users/carlos/Projects/managgio/app/backend/src/bootstrap/nest/guards/admin-global.guard.ts)

Post-migration enforcement:
- `contexts/*` no puede importar `modules/*` (ver [ADR-0009](/Users/carlos/Projects/managgio/app/backend/docs/adr/ADR-0009-post-migration-boundary-enforcement.md)).
- Guardrails automatizados:
  - `npm run arch:check`
  - `npm run migration:inventory:context-module-bridges:enforce-zero`
  - `npm run migration:gate:ci`

Do not place business logic in this folder.
