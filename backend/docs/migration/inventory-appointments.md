# Inventario Automático de Appointments

- Generado: 2026-03-04T08:51:04.778Z
- Fuente controller: `src/modules/appointments/appointments.controller.ts`
- Fuente service: `src/modules/appointments/appointments.service.ts`

## Endpoints (`AppointmentsController`)

| Método | Path | Handler | Admin |
|---|---|---|---|
| GET | /appointments/availability | getAvailability | no |
| GET | /appointments/availability-batch | getAvailabilityBatch | no |
| GET | /appointments/weekly-load | getWeeklyLoad | no |
| GET | /appointments/dashboard-summary | getDashboardSummary | yes |
| GET | /appointments/admin-search | findAdminSearch | yes |
| GET | /appointments/admin-calendar | findAdminCalendar | yes |
| GET | /appointments | findAll | no |
| GET | /appointments/:id | findOne | no |
| POST | /appointments | create | no |
| POST | /appointments/:id/anonymize | anonymize | yes |
| PATCH | /appointments/:id | update | no |
| DELETE | /appointments/:id | remove | no |

## Import Graph (`appointments.service.ts` -> dependencias directas)

- `@nestjs/common`
- `@prisma/client`
- `../../prisma/prisma.service`
- `../../tenancy/tenant.context`
- `./dto/create-appointment.dto`
- `./dto/update-appointment.dto`
- `./appointments.mapper`
- `../schedules/schedule.utils`
- `../holidays/holidays.service`
- `../schedules/schedules.service`
- `../schedules/schedule.types`
- `../notifications/notifications.service`
- `../services/services.pricing`
- `../legal/legal.service`
- `../audit-logs/audit-logs.service`
- `../settings/settings.service`
- `../products/products.pricing`
- `../loyalty/loyalty.service`
- `../referrals/referral-attribution.service`
- `../referrals/rewards.service`
- `../reviews/review-request.service`
- `../barbers/barbers.service`
- `../subscriptions/subscriptions.service`
- `../../utils/timezone`

## Constructor DI Graph (`appointments.service.ts`)

- `prisma: PrismaService`
- `holidaysService: HolidaysService`
- `schedulesService: SchedulesService`
- `notificationsService: NotificationsService`
- `legalService: LegalService`
- `auditLogs: AuditLogsService`
- `settingsService: SettingsService`
- `loyaltyService: LoyaltyService`
- `referralAttributionService: ReferralAttributionService`
- `rewardsService: RewardsService`
- `reviewRequestService: ReviewRequestService`
- `barbersService: BarbersService`
- `subscriptionsService: SubscriptionsService`

## Reverse Graph (módulos que importan `AppointmentsService`)

- `src/modules/ai-assistant/ai-tools.registry.ts`
- `src/modules/appointments/appointments-retention.service.ts`
- `src/modules/appointments/appointments-status-sync.service.ts`
- `src/modules/appointments/appointments.legacy.service.ts`
- `src/modules/appointments/appointments.module.ts`
- `src/modules/payments/payments.service.ts`

## Regeneración

- Ejecutar: `node scripts/migration/generate-appointments-inventory.mjs`
