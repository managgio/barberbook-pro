CREATE TABLE `CommunicationCampaign` (
  `id` VARCHAR(191) NOT NULL,
  `brandId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `originCampaignId` VARCHAR(191) NULL,
  `actionType` ENUM('solo_comunicar', 'comunicar_y_cancelar') NOT NULL,
  `scopeType` ENUM('all_day', 'day_time_range', 'professional_single', 'professional_multi', 'appointment_selection', 'all_clients') NOT NULL,
  `channel` ENUM('email', 'sms', 'whatsapp') NOT NULL,
  `templateKey` ENUM('medical_leave', 'local_closure', 'delay_incident', 'organizational_change', 'general_announcement') NOT NULL,
  `status` ENUM('draft', 'scheduled', 'running', 'completed', 'partial', 'failed', 'cancelled') NOT NULL DEFAULT 'draft',
  `title` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NULL,
  `message` TEXT NOT NULL,
  `internalNote` TEXT NULL,
  `scopeConfig` JSON NULL,
  `options` JSON NULL,
  `impactSummary` JSON NULL,
  `resultSummary` JSON NULL,
  `scheduledFor` DATETIME(3) NULL,
  `executedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `holidayGeneralId` INTEGER NULL,
  `holidayBarberId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommunicationExecution` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `initiatedByUserId` VARCHAR(191) NULL,
  `mode` ENUM('immediate', 'scheduled') NOT NULL,
  `idempotencyKey` VARCHAR(100) NOT NULL,
  `status` ENUM('running', 'completed', 'partial', 'failed', 'cancelled') NOT NULL DEFAULT 'running',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  `summary` JSON NULL,
  `errorMessage` TEXT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `CommunicationExecution_campaignId_idempotencyKey_key` (`campaignId`, `idempotencyKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommunicationRecipientResult` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `executionId` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `appointmentId` VARCHAR(191) NULL,
  `recipientKey` VARCHAR(191) NOT NULL,
  `recipientName` VARCHAR(191) NULL,
  `recipientEmail` VARCHAR(191) NULL,
  `recipientPhone` VARCHAR(191) NULL,
  `channel` ENUM('email', 'sms', 'whatsapp') NOT NULL,
  `status` ENUM('sent', 'failed', 'skipped', 'excluded') NOT NULL,
  `errorCode` VARCHAR(100) NULL,
  `errorMessage` TEXT NULL,
  `excludedAlreadyNotified` BOOLEAN NOT NULL DEFAULT false,
  `cancelledAppointment` BOOLEAN NOT NULL DEFAULT false,
  `notifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommunicationChannelPreference` (
  `id` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `preferredChannel` ENUM('email', 'sms', 'whatsapp') NOT NULL DEFAULT 'email',
  `updatedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `CommunicationChannelPreference_localId_key` (`localId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `CommunicationCampaign_brandId_localId_status_createdAt_idx`
  ON `CommunicationCampaign`(`brandId`, `localId`, `status`, `createdAt`);
CREATE INDEX `CommunicationCampaign_localId_scheduledFor_status_idx`
  ON `CommunicationCampaign`(`localId`, `scheduledFor`, `status`);
CREATE INDEX `CommunicationCampaign_originCampaignId_idx`
  ON `CommunicationCampaign`(`originCampaignId`);

CREATE INDEX `CommunicationExecution_localId_status_startedAt_idx`
  ON `CommunicationExecution`(`localId`, `status`, `startedAt`);

CREATE INDEX `CommunicationRecipientResult_localId_campaignId_idx`
  ON `CommunicationRecipientResult`(`localId`, `campaignId`);
CREATE INDEX `CommunicationRecipientResult_executionId_idx`
  ON `CommunicationRecipientResult`(`executionId`);
CREATE INDEX `CommunicationRecipientResult_localId_recipientKey_status_idx`
  ON `CommunicationRecipientResult`(`localId`, `recipientKey`, `status`);
CREATE INDEX `CommunicationRecipientResult_appointmentId_idx`
  ON `CommunicationRecipientResult`(`appointmentId`);
CREATE INDEX `CommunicationRecipientResult_userId_idx`
  ON `CommunicationRecipientResult`(`userId`);

CREATE INDEX `CommunicationChannelPreference_localId_preferredChannel_idx`
  ON `CommunicationChannelPreference`(`localId`, `preferredChannel`);

ALTER TABLE `CommunicationCampaign`
  ADD CONSTRAINT `CommunicationCampaign_brandId_fkey`
    FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationCampaign_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationCampaign_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationCampaign_originCampaignId_fkey`
    FOREIGN KEY (`originCampaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationCampaign_holidayGeneralId_fkey`
    FOREIGN KEY (`holidayGeneralId`) REFERENCES `GeneralHoliday`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationCampaign_holidayBarberId_fkey`
    FOREIGN KEY (`holidayBarberId`) REFERENCES `BarberHoliday`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CommunicationExecution`
  ADD CONSTRAINT `CommunicationExecution_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationExecution_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationExecution_initiatedByUserId_fkey`
    FOREIGN KEY (`initiatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CommunicationRecipientResult`
  ADD CONSTRAINT `CommunicationRecipientResult_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationRecipientResult_executionId_fkey`
    FOREIGN KEY (`executionId`) REFERENCES `CommunicationExecution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationRecipientResult_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationRecipientResult_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationRecipientResult_appointmentId_fkey`
    FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CommunicationChannelPreference`
  ADD CONSTRAINT `CommunicationChannelPreference_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CommunicationChannelPreference_updatedByUserId_fkey`
    FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
