ALTER TABLE `Appointment`
  ADD COLUMN `guestEmail` VARCHAR(254) NULL,
  ADD COLUMN `guestPhone` VARCHAR(40) NULL;

UPDATE `Appointment`
SET
  `guestEmail` = CASE
    WHEN `guestContact` IS NULL OR TRIM(`guestContact`) = '' THEN NULL
    WHEN `guestContact` LIKE '%·%' AND TRIM(SUBSTRING_INDEX(`guestContact`, '·', 1)) LIKE '%@%'
      THEN TRIM(SUBSTRING_INDEX(`guestContact`, '·', 1))
    WHEN `guestContact` LIKE '%·%' AND TRIM(SUBSTRING_INDEX(`guestContact`, '·', -1)) LIKE '%@%'
      THEN TRIM(SUBSTRING_INDEX(`guestContact`, '·', -1))
    WHEN TRIM(`guestContact`) LIKE '%@%' THEN TRIM(`guestContact`)
    ELSE NULL
  END,
  `guestPhone` = CASE
    WHEN `guestContact` IS NULL OR TRIM(`guestContact`) = '' THEN NULL
    WHEN `guestContact` LIKE '%·%' AND TRIM(SUBSTRING_INDEX(`guestContact`, '·', 1)) NOT LIKE '%@%'
      THEN TRIM(SUBSTRING_INDEX(`guestContact`, '·', 1))
    WHEN `guestContact` LIKE '%·%' AND TRIM(SUBSTRING_INDEX(`guestContact`, '·', -1)) NOT LIKE '%@%'
      THEN TRIM(SUBSTRING_INDEX(`guestContact`, '·', -1))
    WHEN TRIM(`guestContact`) NOT LIKE '%@%' THEN TRIM(`guestContact`)
    ELSE NULL
  END
WHERE `userId` IS NULL;

CREATE TABLE `email_deliveries` (
  `id` VARCHAR(191) NOT NULL,
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NULL,
  `kind` ENUM('appointment_created', 'appointment_updated', 'appointment_cancelled', 'earlier_slot', 'communication', 'referral_reward') NOT NULL,
  `status` ENUM('pending', 'processing', 'accepted', 'retrying', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `recipientEmail` VARCHAR(254) NULL,
  `recipientName` VARCHAR(191) NULL,
  `subject` VARCHAR(255) NOT NULL,
  `payload` JSON NOT NULL,
  `correlationId` VARCHAR(80) NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  `nextAttemptAt` DATETIME(3) NULL,
  `processingStartedAt` DATETIME(3) NULL,
  `providerMessageId` VARCHAR(191) NULL,
  `lastErrorCode` VARCHAR(100) NULL,
  `lastErrorMessage` VARCHAR(500) NULL,
  `acceptedAt` DATETIME(3) NULL,
  `failedAt` DATETIME(3) NULL,
  `skippedAt` DATETIME(3) NULL,
  `criticalTraceReportedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_deliveries_idempotencyKey_key` (`idempotencyKey`),
  INDEX `email_deliveries_localId_status_nextAttemptAt_createdAt_idx` (`localId`, `status`, `nextAttemptAt`, `createdAt`),
  INDEX `email_deliveries_brandId_status_createdAt_idx` (`brandId`, `status`, `createdAt`),
  INDEX `email_deliveries_appointmentId_createdAt_idx` (`appointmentId`, `createdAt`),
  INDEX `email_deliveries_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `email_delivery_attempts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `deliveryId` VARCHAR(191) NOT NULL,
  `attemptNumber` INTEGER NOT NULL,
  `status` ENUM('accepted', 'failed', 'skipped') NOT NULL,
  `providerMessageId` VARCHAR(191) NULL,
  `errorCode` VARCHAR(100) NULL,
  `errorMessage` VARCHAR(500) NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_delivery_attempts_deliveryId_attemptNumber_key` (`deliveryId`, `attemptNumber`),
  INDEX `email_delivery_attempts_deliveryId_occurredAt_idx` (`deliveryId`, `occurredAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `email_deliveries`
  ADD CONSTRAINT `email_deliveries_brandId_fkey`
    FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `email_deliveries_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `email_deliveries_appointmentId_fkey`
    FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `email_delivery_attempts`
  ADD CONSTRAINT `email_delivery_attempts_deliveryId_fkey`
    FOREIGN KEY (`deliveryId`) REFERENCES `email_deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
