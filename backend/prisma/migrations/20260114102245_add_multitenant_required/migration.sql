/*
  Warnings:

  - Made the column `localId` on table `AdminRole` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `Alert` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `Barber` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `BarberHoliday` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `BarberSchedule` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `GeneralHoliday` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `Offer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `Service` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `ServiceCategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `ShopSchedule` required. This step will fail if there are existing NULL values in that column.
  - Made the column `localId` on table `SiteSettings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `local_id` on table `ai_business_facts` required. This step will fail if there are existing NULL values in that column.
  - Made the column `local_id` on table `ai_chat_messages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `local_id` on table `ai_chat_sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `AdminRole` DROP FOREIGN KEY `AdminRole_localId_fkey`;

-- DropForeignKey
ALTER TABLE `Alert` DROP FOREIGN KEY `Alert_localId_fkey`;

-- DropForeignKey
ALTER TABLE `Appointment` DROP FOREIGN KEY `Appointment_localId_fkey`;

-- DropForeignKey
ALTER TABLE `Barber` DROP FOREIGN KEY `Barber_localId_fkey`;

-- DropForeignKey
ALTER TABLE `BarberHoliday` DROP FOREIGN KEY `BarberHoliday_localId_fkey`;

-- DropForeignKey
ALTER TABLE `BarberSchedule` DROP FOREIGN KEY `BarberSchedule_localId_fkey`;

-- DropForeignKey
ALTER TABLE `GeneralHoliday` DROP FOREIGN KEY `GeneralHoliday_localId_fkey`;

-- DropForeignKey
ALTER TABLE `Offer` DROP FOREIGN KEY `Offer_localId_fkey`;

-- DropForeignKey
ALTER TABLE `Service` DROP FOREIGN KEY `Service_localId_fkey`;

-- DropForeignKey
ALTER TABLE `ServiceCategory` DROP FOREIGN KEY `ServiceCategory_localId_fkey`;

-- DropForeignKey
ALTER TABLE `ShopSchedule` DROP FOREIGN KEY `ShopSchedule_localId_fkey`;

-- DropForeignKey
ALTER TABLE `SiteSettings` DROP FOREIGN KEY `SiteSettings_localId_fkey`;

-- DropForeignKey
ALTER TABLE `ai_business_facts` DROP FOREIGN KEY `ai_business_facts_local_id_fkey`;

-- DropForeignKey
ALTER TABLE `ai_chat_messages` DROP FOREIGN KEY `ai_chat_messages_local_id_fkey`;

-- DropForeignKey
ALTER TABLE `ai_chat_sessions` DROP FOREIGN KEY `ai_chat_sessions_local_id_fkey`;

-- AlterTable
ALTER TABLE `AdminRole` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Alert` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Appointment` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Barber` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `BarberHoliday` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `BarberSchedule` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `GeneralHoliday` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Offer` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Service` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ServiceCategory` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ShopSchedule` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `SiteSettings` MODIFY `localId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ai_business_facts` MODIFY `local_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ai_chat_messages` MODIFY `local_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ai_chat_sessions` MODIFY `local_id` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `AdminRole` ADD CONSTRAINT `AdminRole_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Barber` ADD CONSTRAINT `Barber_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneralHoliday` ADD CONSTRAINT `GeneralHoliday_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BarberHoliday` ADD CONSTRAINT `BarberHoliday_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopSchedule` ADD CONSTRAINT `ShopSchedule_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteSettings` ADD CONSTRAINT `SiteSettings_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BarberSchedule` ADD CONSTRAINT `BarberSchedule_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceCategory` ADD CONSTRAINT `ServiceCategory_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_business_facts` ADD CONSTRAINT `ai_business_facts_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
