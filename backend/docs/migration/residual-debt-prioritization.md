# Residual Debt Prioritization (Post-Migration)

- Generated: 2026-03-07T11:38:20.207Z
- Modules analyzed: 29
- Service files analyzed: 39
- Modules with direct Prisma usage: 0
- Priority distribution: P0=0, P1=0, P2=0, P3=29
- Pending backlog (real debt): total=0, P0=0, P1=0, P2=0, P3=0

## Scoring Heuristics

- Higher score means higher refactor priority.
- Score factors: module size (LOC), direct Prisma dependency, external SDK usage, cross-module helpers, direct service-to-service module dependencies.
- Score reducers: module already using ports/use-cases and low direct infrastructure coupling.

## Prioritized Modules (Pending Only)

| Priority | Module | Score | Pending (real debt) | Services | LOC | Prisma | Port Injects | Target Context |
|---|---|---:|---|---:|---:|---|---:|---|
| - | - | - | - | - | - | - | - | - |

- No pending modules to prioritize.

## Pending Backlog (Unresolved Couplings)

| Priority | Module | Score | Prisma | SDK Imports | Cross Utils | Service Deps |
|---|---|---:|---|---:|---:|---:|
| - | - | - | - | - | - | - |

- No pending modules with unresolved couplings.

## Top Actionable Backlog

- No pending P0/P1/P2/P3 modules detected.

## Regeneration

- Command: `npm run migration:inventory:residual-debt`

