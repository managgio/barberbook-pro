-- Referral code lookups by tenant and recency
CREATE INDEX `ReferralCode_localId_createdAt_idx` ON `ReferralCode`(`localId`, `createdAt`);

-- Reward transaction streams by tenant/state/time
CREATE INDEX `RewardTransaction_localId_status_createdAt_idx` ON `RewardTransaction`(`localId`, `status`, `createdAt`);

-- Cash register time-range scans per tenant
CREATE INDEX `CashMovement_localId_occurredAt_idx` ON `CashMovement`(`localId`, `occurredAt`);
CREATE INDEX `CashMovement_localId_createdAt_idx` ON `CashMovement`(`localId`, `createdAt`);

-- Client note timelines by tenant/client
CREATE INDEX `ClientNote_localId_userId_createdAt_idx` ON `ClientNote`(`localId`, `userId`, `createdAt`);

-- Observability dashboards by tenant/time
CREATE INDEX `web_vital_events_localId_timestamp_idx` ON `web_vital_events`(`localId`, `timestamp`);
CREATE INDEX `api_metric_events_localId_timestamp_idx` ON `api_metric_events`(`localId`, `timestamp`);
