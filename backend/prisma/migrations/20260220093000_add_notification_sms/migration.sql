-- AlterTable
ALTER TABLE `User` ADD COLUMN `notificationSms` BOOLEAN NOT NULL DEFAULT true;

-- Backfill
UPDATE `User` SET `notificationSms` = `notificationWhatsapp`;
