-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `loyaltyProgramId` VARCHAR(191) NULL,
    ADD COLUMN `loyaltyRewardApplied` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `LoyaltyProgram` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `scope` ENUM('global', 'service', 'category') NOT NULL,
    `requiredVisits` INTEGER NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `serviceId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LoyaltyProgram_localId_idx`(`localId`),
    INDEX `LoyaltyProgram_serviceId_idx`(`serviceId`),
    INDEX `LoyaltyProgram_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_loyaltyProgramId_fkey` FOREIGN KEY (`loyaltyProgramId`) REFERENCES `LoyaltyProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyProgram` ADD CONSTRAINT `LoyaltyProgram_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyProgram` ADD CONSTRAINT `LoyaltyProgram_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyProgram` ADD CONSTRAINT `LoyaltyProgram_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
