# Transition Artifacts Checklist

- Generated: 2026-03-07T11:41:24.592Z
- Total artifacts tracked: 18
- Present: 0
- Removed: 18

## Rules

- This file is generated; do not edit manually.
- Mark removal by deleting the artifact in code and regenerating.
- PRs that remove artifacts must update roadmap + this checklist in the same commit.

## Artifacts

| Status | ID | Type | Delete Phase | Artifact | Notes |
|---|---|---|---|---|---|
| ☑ removed | MIG-LEGACY-APPOINTMENTS-BRIDGE | legacy-bridge | PR20 | `src/modules/appointments/appointments.legacy.service.ts` | Bridge principal del strangler en appointments. |
| ☑ removed | MIG-LEGACY-BOOKING-COMMAND | legacy-adapter | PR20 | `src/contexts/booking/infrastructure/adapters/legacy-booking-command.adapter.ts` | Delega command port al service legacy. |
| ☑ removed | MIG-LEGACY-BOOKING-MAINTENANCE | legacy-adapter | PR20 | `src/contexts/booking/infrastructure/adapters/legacy-booking-maintenance.adapter.ts` | Delega maintenance port al service legacy. |
| ☑ removed | MIG-LEGACY-BOOKING-SIDE-EFFECTS | legacy-adapter | PR20 | `src/contexts/booking/infrastructure/adapters/legacy-booking-status-side-effects.adapter.ts` | Orquestación de side-effects heredada. |
| ☑ removed | MIG-LEGACY-BOOKING-UOW | legacy-adapter | PR20 | `src/contexts/booking/infrastructure/adapters/legacy-booking-unit-of-work.adapter.ts` | UoW puente mientras convive create/update legacy. |
| ☑ removed | MIG-LEGACY-COMMERCE-SUBSCRIPTION | legacy-adapter | PR20 | `src/contexts/commerce/infrastructure/adapters/legacy-commerce-subscription-policy.adapter.ts` | ACL de suscripciones sobre service legacy. |
| ☑ removed | MIG-LEGACY-COMMERCE-LOYALTY | legacy-adapter | PR20 | `src/contexts/commerce/infrastructure/adapters/legacy-commerce-loyalty-policy.adapter.ts` | ACL de loyalty sobre service legacy. |
| ☑ removed | MIG-LEGACY-COMMERCE-WALLET | legacy-adapter | PR20 | `src/contexts/commerce/infrastructure/adapters/legacy-commerce-wallet-ledger.adapter.ts` | ACL wallet/coupon sobre rewards legacy. |
| ☑ removed | MIG-LEGACY-ENGAGEMENT-ATTRIBUTION | legacy-adapter | PR20 | `src/contexts/engagement/infrastructure/adapters/legacy-engagement-referral-attribution.adapter.ts` | Puente attribution mientras se cierra core engagement. |
| ☑ removed | MIG-LEGACY-ENGAGEMENT-REWARD | legacy-adapter | PR20 | `src/contexts/engagement/infrastructure/adapters/legacy-engagement-referral-reward.adapter.ts` | Puente emisión de recompensas legacy. |
| ☑ removed | MIG-LEGACY-ENGAGEMENT-NOTIFICATION | legacy-adapter | PR20 | `src/contexts/engagement/infrastructure/adapters/legacy-engagement-referral-notification.adapter.ts` | Puente notificaciones de referidos legacy. |
| ☑ removed | MIG-LEGACY-AI-BOOKING-TOOLS | legacy-adapter | PR20 | `src/contexts/ai-orchestration/infrastructure/adapters/legacy-ai-booking-tool.adapter.ts` | Tool adapter legacy para booking en IA. |
| ☑ removed | MIG-LEGACY-AI-HOLIDAY-TOOLS | legacy-adapter | PR20 | `src/contexts/ai-orchestration/infrastructure/adapters/legacy-ai-holiday-tool.adapter.ts` | Tool adapter legacy para holidays en IA. |
| ☑ removed | MIG-LEGACY-AI-ALERT-TOOLS | legacy-adapter | PR20 | `src/contexts/ai-orchestration/infrastructure/adapters/legacy-ai-alert-tool.adapter.ts` | Tool adapter legacy para alerts en IA. |
| ☑ removed | MIG-FLAG-ALIAS-BOOKING-AVAILABILITY | flag-alias | PR20 | `src/modules/appointments/appointments.flags.ts (BOOKING_AVAILABILITY_MODE)` | Alias legacy global; sustituir por capability flags. |
| ☑ removed | MIG-FLAG-ALIAS-BOOKING-CREATE | flag-alias | PR20 | `src/modules/appointments/appointments.flags.ts (BOOKING_CREATE_MODE)` | Alias legacy para create. |
| ☑ removed | MIG-FLAG-ALIAS-BOOKING-UPDATE | flag-alias | PR20 | `src/modules/appointments/appointments.flags.ts (BOOKING_UPDATE_MODE)` | Alias legacy para update. |
| ☑ removed | MIG-FLAG-ALIAS-BOOKING-REMOVE | flag-alias | PR20 | `src/modules/appointments/appointments.flags.ts (BOOKING_REMOVE_MODE)` | Alias legacy para remove. |

## Regeneration

- Command: `npm run migration:inventory:transition-artifacts`

