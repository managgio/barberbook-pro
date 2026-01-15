/*
  Warnings:

  - A unique constraint covering the columns `[subdomain]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[customDomain]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[defaultLocationId]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[brandId,slug]` on the table `Location` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Brand` ADD COLUMN `customDomain` VARCHAR(191) NULL,
    ADD COLUMN `defaultLocationId` VARCHAR(191) NULL,
    ADD COLUMN `subdomain` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Location` ADD COLUMN `slug` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `BrandConfig` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BrandConfig_brandId_key`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LocationConfig` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LocationConfig_localId_key`(`localId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Brand_subdomain_key` ON `Brand`(`subdomain`);

-- CreateIndex
CREATE UNIQUE INDEX `Brand_customDomain_key` ON `Brand`(`customDomain`);

-- CreateIndex
CREATE UNIQUE INDEX `Brand_defaultLocationId_key` ON `Brand`(`defaultLocationId`);

-- CreateIndex
CREATE UNIQUE INDEX `Location_brandId_slug_key` ON `Location`(`brandId`, `slug`);

-- AddForeignKey
ALTER TABLE `Brand` ADD CONSTRAINT `Brand_defaultLocationId_fkey` FOREIGN KEY (`defaultLocationId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrandConfig` ADD CONSTRAINT `BrandConfig_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LocationConfig` ADD CONSTRAINT `LocationConfig_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
