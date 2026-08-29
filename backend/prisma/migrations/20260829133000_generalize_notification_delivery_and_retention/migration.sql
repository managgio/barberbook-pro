RENAME TABLE
  `email_delivery_attempts` TO `notification_delivery_attempts`,
  `email_deliveries` TO `notification_deliveries`;

ALTER TABLE `notification_delivery_attempts`
  DROP FOREIGN KEY `email_delivery_attempts_deliveryId_fkey`;

ALTER TABLE `notification_deliveries`
  DROP FOREIGN KEY `email_deliveries_brandId_fkey`,
  DROP FOREIGN KEY `email_deliveries_localId_fkey`,
  DROP FOREIGN KEY `email_deliveries_appointmentId_fkey`;

ALTER TABLE `notification_deliveries`
  ADD COLUMN `channel` ENUM('email', 'sms', 'whatsapp') NOT NULL DEFAULT 'email' AFTER `appointmentId`,
  MODIFY COLUMN `kind` ENUM('appointment_created', 'appointment_updated', 'appointment_cancelled', 'earlier_slot', 'reminder', 'communication', 'referral_reward') NOT NULL,
  ADD COLUMN `idempotencyKeyHash` CHAR(64) NULL AFTER `status`,
  CHANGE COLUMN `recipientEmail` `recipientAddress` VARCHAR(254) NULL,
  CHANGE COLUMN `subject` `title` VARCHAR(255) NOT NULL,
  MODIFY COLUMN `payload` JSON NULL,
  ADD COLUMN `redactedAt` DATETIME(3) NULL AFTER `criticalTraceReportedAt`;

UPDATE `notification_deliveries`
SET `idempotencyKeyHash` = LOWER(SHA2(`idempotencyKey`, 256));

ALTER TABLE `notification_deliveries`
  DROP INDEX `email_deliveries_idempotencyKey_key`,
  DROP INDEX `email_deliveries_localId_status_nextAttemptAt_createdAt_idx`,
  DROP INDEX `email_deliveries_brandId_status_createdAt_idx`,
  DROP INDEX `email_deliveries_appointmentId_createdAt_idx`,
  DROP INDEX `email_deliveries_createdAt_idx`,
  MODIFY COLUMN `idempotencyKeyHash` CHAR(64) NOT NULL,
  DROP COLUMN `idempotencyKey`,
  ADD UNIQUE INDEX `nd_idempotency_hash_key` (`idempotencyKeyHash`),
  ADD INDEX `nd_local_status_channel_due_idx` (`localId`, `status`, `channel`, `nextAttemptAt`, `createdAt`),
  ADD INDEX `nd_brand_status_channel_created_idx` (`brandId`, `status`, `channel`, `createdAt`),
  ADD INDEX `nd_status_redacted_created_idx` (`status`, `redactedAt`, `createdAt`),
  ADD INDEX `nd_appointment_created_idx` (`appointmentId`, `createdAt`),
  ADD INDEX `nd_created_idx` (`createdAt`);

ALTER TABLE `notification_deliveries`
  ADD CONSTRAINT `notification_deliveries_brandId_fkey`
    FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notification_deliveries_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notification_deliveries_appointmentId_fkey`
    FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `notification_delivery_attempts`
  DROP INDEX `email_delivery_attempts_deliveryId_attemptNumber_key`,
  DROP INDEX `email_delivery_attempts_deliveryId_occurredAt_idx`,
  ADD UNIQUE INDEX `nda_delivery_attempt_key` (`deliveryId`, `attemptNumber`),
  ADD INDEX `nda_delivery_occurred_idx` (`deliveryId`, `occurredAt`),
  ADD CONSTRAINT `notification_delivery_attempts_deliveryId_fkey`
    FOREIGN KEY (`deliveryId`) REFERENCES `notification_deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
