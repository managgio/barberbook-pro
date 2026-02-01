-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `appliedCouponId` VARCHAR(191) NULL,
    ADD COLUMN `referralAttributionId` VARCHAR(191) NULL,
    ADD COLUMN `walletAppliedAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `ReferralProgramConfig` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `attributionExpiryDays` INTEGER NOT NULL DEFAULT 30,
    `newCustomerOnly` BOOLEAN NOT NULL DEFAULT true,
    `monthlyMaxRewardsPerReferrer` INTEGER NULL,
    `allowedServiceIds` JSON NULL,
    `rewardReferrerType` ENUM('WALLET', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SERVICE') NOT NULL,
    `rewardReferrerValue` DECIMAL(10, 2) NULL,
    `rewardReferrerServiceId` VARCHAR(191) NULL,
    `rewardReferredType` ENUM('WALLET', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SERVICE') NOT NULL,
    `rewardReferredValue` DECIMAL(10, 2) NULL,
    `rewardReferredServiceId` VARCHAR(191) NULL,
    `antiFraud` JSON NULL,
    `appliedTemplateId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReferralProgramConfig_localId_key`(`localId`),
    INDEX `ReferralProgramConfig_rewardReferrerServiceId_idx`(`rewardReferrerServiceId`),
    INDEX `ReferralProgramConfig_rewardReferredServiceId_idx`(`rewardReferredServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralConfigTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `attributionExpiryDays` INTEGER NOT NULL DEFAULT 30,
    `newCustomerOnly` BOOLEAN NOT NULL DEFAULT true,
    `monthlyMaxRewardsPerReferrer` INTEGER NULL,
    `allowedServiceIds` JSON NULL,
    `rewardReferrerType` ENUM('WALLET', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SERVICE') NOT NULL,
    `rewardReferrerValue` DECIMAL(10, 2) NULL,
    `rewardReferrerServiceId` VARCHAR(191) NULL,
    `rewardReferredType` ENUM('WALLET', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SERVICE') NOT NULL,
    `rewardReferredValue` DECIMAL(10, 2) NULL,
    `rewardReferredServiceId` VARCHAR(191) NULL,
    `antiFraud` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReferralConfigTemplate_brandId_idx`(`brandId`),
    INDEX `ReferralConfigTemplate_rewardReferrerServiceId_idx`(`rewardReferrerServiceId`),
    INDEX `ReferralConfigTemplate_rewardReferredServiceId_idx`(`rewardReferredServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralCode` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReferralCode_localId_idx`(`localId`),
    UNIQUE INDEX `ReferralCode_code_localId_key`(`code`, `localId`),
    UNIQUE INDEX `ReferralCode_userId_localId_key`(`userId`, `localId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralAttribution` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `referralCodeId` VARCHAR(191) NOT NULL,
    `referrerUserId` VARCHAR(191) NOT NULL,
    `referredUserId` VARCHAR(191) NULL,
    `referredPhone` VARCHAR(191) NULL,
    `referredEmail` VARCHAR(191) NULL,
    `status` ENUM('ATTRIBUTED', 'BOOKED', 'COMPLETED', 'REWARDED', 'VOIDED', 'EXPIRED') NOT NULL DEFAULT 'ATTRIBUTED',
    `firstAppointmentId` VARCHAR(191) NULL,
    `attributedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReferralAttribution_localId_status_idx`(`localId`, `status`),
    INDEX `ReferralAttribution_localId_createdAt_idx`(`localId`, `createdAt`),
    INDEX `ReferralAttribution_referrerUserId_idx`(`referrerUserId`),
    INDEX `ReferralAttribution_referredUserId_idx`(`referredUserId`),
    INDEX `ReferralAttribution_referredPhone_idx`(`referredPhone`),
    INDEX `ReferralAttribution_referredEmail_idx`(`referredEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardWallet` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RewardWallet_localId_idx`(`localId`),
    UNIQUE INDEX `RewardWallet_userId_localId_key`(`userId`, `localId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `referralAttributionId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `couponId` VARCHAR(191) NULL,
    `walletId` VARCHAR(191) NULL,
    `type` ENUM('CREDIT', 'DEBIT', 'HOLD', 'RELEASE', 'COUPON_ISSUED', 'COUPON_USED', 'ADJUSTMENT') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(10, 2) NULL,
    `description` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RewardTransaction_userId_localId_createdAt_idx`(`userId`, `localId`, `createdAt`),
    INDEX `RewardTransaction_referralAttributionId_idx`(`referralAttributionId`),
    INDEX `RewardTransaction_appointmentId_idx`(`appointmentId`),
    INDEX `RewardTransaction_couponId_idx`(`couponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `discountType` ENUM('WALLET', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SERVICE') NOT NULL,
    `discountValue` DECIMAL(10, 2) NULL,
    `serviceId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `maxUses` INTEGER NOT NULL DEFAULT 1,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `validFrom` DATETIME(3) NULL,
    `validTo` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Coupon_localId_idx`(`localId`),
    INDEX `Coupon_userId_idx`(`userId`),
    INDEX `Coupon_serviceId_idx`(`serviceId`),
    UNIQUE INDEX `Coupon_code_localId_key`(`code`, `localId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Appointment_referralAttributionId_idx` ON `Appointment`(`referralAttributionId`);

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_referralAttributionId_fkey` FOREIGN KEY (`referralAttributionId`) REFERENCES `ReferralAttribution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_appliedCouponId_fkey` FOREIGN KEY (`appliedCouponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralProgramConfig` ADD CONSTRAINT `ReferralProgramConfig_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralProgramConfig` ADD CONSTRAINT `ReferralProgramConfig_rewardReferrerServiceId_fkey` FOREIGN KEY (`rewardReferrerServiceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralProgramConfig` ADD CONSTRAINT `ReferralProgramConfig_rewardReferredServiceId_fkey` FOREIGN KEY (`rewardReferredServiceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralProgramConfig` ADD CONSTRAINT `ReferralProgramConfig_appliedTemplateId_fkey` FOREIGN KEY (`appliedTemplateId`) REFERENCES `ReferralConfigTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralConfigTemplate` ADD CONSTRAINT `ReferralConfigTemplate_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralConfigTemplate` ADD CONSTRAINT `ReferralConfigTemplate_rewardReferrerServiceId_fkey` FOREIGN KEY (`rewardReferrerServiceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralConfigTemplate` ADD CONSTRAINT `ReferralConfigTemplate_rewardReferredServiceId_fkey` FOREIGN KEY (`rewardReferredServiceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralCode` ADD CONSTRAINT `ReferralCode_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralCode` ADD CONSTRAINT `ReferralCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralAttribution` ADD CONSTRAINT `ReferralAttribution_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralAttribution` ADD CONSTRAINT `ReferralAttribution_referralCodeId_fkey` FOREIGN KEY (`referralCodeId`) REFERENCES `ReferralCode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralAttribution` ADD CONSTRAINT `ReferralAttribution_referrerUserId_fkey` FOREIGN KEY (`referrerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralAttribution` ADD CONSTRAINT `ReferralAttribution_referredUserId_fkey` FOREIGN KEY (`referredUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralAttribution` ADD CONSTRAINT `ReferralAttribution_firstAppointmentId_fkey` FOREIGN KEY (`firstAppointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardWallet` ADD CONSTRAINT `RewardWallet_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardWallet` ADD CONSTRAINT `RewardWallet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_referralAttributionId_fkey` FOREIGN KEY (`referralAttributionId`) REFERENCES `ReferralAttribution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardTransaction` ADD CONSTRAINT `RewardTransaction_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `RewardWallet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
