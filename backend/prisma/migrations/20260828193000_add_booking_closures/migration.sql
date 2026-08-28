CREATE TABLE `BookingClosure` (
  `id` VARCHAR(191) NOT NULL,
  `localId` VARCHAR(191) NOT NULL,
  `barberId` VARCHAR(191) NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `startDateTime` DATETIME(3) NOT NULL,
  `endDateTime` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `BookingClosure_localId_startDateTime_endDateTime_idx`
  ON `BookingClosure`(`localId`, `startDateTime`, `endDateTime`);
CREATE INDEX `BookingClosure_localId_barberId_startDateTime_endDateTime_idx`
  ON `BookingClosure`(`localId`, `barberId`, `startDateTime`, `endDateTime`);
CREATE INDEX `BookingClosure_campaignId_idx`
  ON `BookingClosure`(`campaignId`);

ALTER TABLE `BookingClosure`
  ADD CONSTRAINT `BookingClosure_localId_fkey`
    FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BookingClosure_barberId_fkey`
    FOREIGN KEY (`barberId`) REFERENCES `Barber`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BookingClosure_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `CommunicationCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
