/*
  Warnings:

  - A unique constraint covering the columns `[localId]` on the table `ShopSchedule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[localId]` on the table `SiteSettings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[local_id,key]` on the table `ai_business_facts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `ai_business_facts_key_key` ON `ai_business_facts`;

-- AlterTable
ALTER TABLE `AdminRole` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Alert` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Barber` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BarberHoliday` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BarberSchedule` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `GeneralHoliday` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Offer` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Service` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ServiceCategory` ADD COLUMN `localId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ShopSchedule` ADD COLUMN `localId` VARCHAR(191) NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT;

-- AlterTable
ALTER TABLE `SiteSettings` ADD COLUMN `localId` VARCHAR(191) NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT;

-- AlterTable
ALTER TABLE `ai_business_facts` ADD COLUMN `local_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ai_chat_messages` ADD COLUMN `local_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ai_chat_sessions` ADD COLUMN `local_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Brand` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Location` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Location_brandId_idx`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrandUser` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BrandUser_userId_idx`(`userId`),
    UNIQUE INDEX `BrandUser_brandId_userId_key`(`brandId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LocationStaff` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `adminRoleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LocationStaff_userId_idx`(`userId`),
    INDEX `LocationStaff_adminRoleId_idx`(`adminRoleId`),
    UNIQUE INDEX `LocationStaff_localId_userId_key`(`localId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AdminRole_localId_idx` ON `AdminRole`(`localId`);

-- CreateIndex
CREATE INDEX `Alert_localId_idx` ON `Alert`(`localId`);

-- CreateIndex
CREATE INDEX `Appointment_localId_idx` ON `Appointment`(`localId`);

-- CreateIndex
CREATE INDEX `Barber_localId_idx` ON `Barber`(`localId`);

-- CreateIndex
CREATE INDEX `BarberHoliday_localId_idx` ON `BarberHoliday`(`localId`);

-- CreateIndex
CREATE INDEX `BarberSchedule_localId_idx` ON `BarberSchedule`(`localId`);

-- CreateIndex
CREATE INDEX `GeneralHoliday_localId_idx` ON `GeneralHoliday`(`localId`);

-- CreateIndex
CREATE INDEX `Offer_localId_idx` ON `Offer`(`localId`);

-- CreateIndex
CREATE INDEX `Service_localId_idx` ON `Service`(`localId`);

-- CreateIndex
CREATE INDEX `ServiceCategory_localId_idx` ON `ServiceCategory`(`localId`);

-- CreateIndex
CREATE UNIQUE INDEX `ShopSchedule_localId_key` ON `ShopSchedule`(`localId`);

-- CreateIndex
CREATE UNIQUE INDEX `SiteSettings_localId_key` ON `SiteSettings`(`localId`);

-- CreateIndex
CREATE INDEX `ai_business_facts_local_id_idx` ON `ai_business_facts`(`local_id`);

-- CreateIndex
CREATE UNIQUE INDEX `ai_business_facts_local_id_key_key` ON `ai_business_facts`(`local_id`, `key`);

-- CreateIndex
CREATE INDEX `ai_chat_messages_local_id_idx` ON `ai_chat_messages`(`local_id`);

-- CreateIndex
CREATE INDEX `ai_chat_sessions_local_id_idx` ON `ai_chat_sessions`(`local_id`);

-- AddForeignKey
ALTER TABLE `Location` ADD CONSTRAINT `Location_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRole` ADD CONSTRAINT `AdminRole_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandUser` ADD CONSTRAINT `BrandUser_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandUser` ADD CONSTRAINT `BrandUser_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LocationStaff` ADD CONSTRAINT `LocationStaff_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LocationStaff` ADD CONSTRAINT `LocationStaff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LocationStaff` ADD CONSTRAINT `LocationStaff_adminRoleId_fkey` FOREIGN KEY (`adminRoleId`) REFERENCES `AdminRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Barber` ADD CONSTRAINT `Barber_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneralHoliday` ADD CONSTRAINT `GeneralHoliday_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BarberHoliday` ADD CONSTRAINT `BarberHoliday_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopSchedule` ADD CONSTRAINT `ShopSchedule_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteSettings` ADD CONSTRAINT `SiteSettings_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BarberSchedule` ADD CONSTRAINT `BarberSchedule_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceCategory` ADD CONSTRAINT `ServiceCategory_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_business_facts` ADD CONSTRAINT `ai_business_facts_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
