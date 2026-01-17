-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `anonymizedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `BrandLegalSettings` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `legalOwnerName` VARCHAR(191) NULL,
    `legalOwnerTaxId` VARCHAR(191) NULL,
    `legalOwnerAddress` VARCHAR(191) NULL,
    `legalContactEmail` VARCHAR(191) NULL,
    `legalContactPhone` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'ES',
    `privacyPolicyVersion` INTEGER NOT NULL DEFAULT 1,
    `cookiePolicyVersion` INTEGER NOT NULL DEFAULT 1,
    `legalNoticeVersion` INTEGER NOT NULL DEFAULT 1,
    `aiDisclosureEnabled` BOOLEAN NOT NULL DEFAULT true,
    `aiProviderNames` JSON NULL,
    `subProcessors` JSON NULL,
    `optionalCustomSections` JSON NULL,
    `retentionDays` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BrandLegalSettings_brandId_key`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `consentType` ENUM('PRIVACY', 'COOKIES', 'MARKETING') NOT NULL,
    `policyVersion` INTEGER NOT NULL,
    `consentGiven` BOOLEAN NOT NULL,
    `consentTextSnapshot` VARCHAR(191) NOT NULL,
    `ipHash` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsentRecord_brandId_idx`(`brandId`),
    INDEX `ConsentRecord_locationId_idx`(`locationId`),
    INDEX `ConsentRecord_bookingId_idx`(`bookingId`),
    INDEX `ConsentRecord_consentType_idx`(`consentType`),
    INDEX `ConsentRecord_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_brandId_idx`(`brandId`),
    INDEX `AuditLog_locationId_idx`(`locationId`),
    INDEX `AuditLog_actorUserId_idx`(`actorUserId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BrandLegalSettings` ADD CONSTRAINT `BrandLegalSettings_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
