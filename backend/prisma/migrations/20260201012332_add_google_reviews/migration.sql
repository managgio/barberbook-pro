-- CreateTable
CREATE TABLE `ReviewProgramConfig` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `googleReviewUrl` VARCHAR(191) NULL,
    `cooldownDays` INTEGER NOT NULL DEFAULT 60,
    `minVisitsToAsk` INTEGER NOT NULL DEFAULT 2,
    `showDelayMinutes` INTEGER NOT NULL DEFAULT 60,
    `maxSnoozes` INTEGER NOT NULL DEFAULT 1,
    `snoozeHours` INTEGER NOT NULL DEFAULT 48,
    `copyJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReviewProgramConfig_localId_key`(`localId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewRequest` (
    `id` VARCHAR(191) NOT NULL,
    `localId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestPhone` VARCHAR(191) NULL,
    `guestEmail` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ELIGIBLE', 'SHOWN', 'RATED', 'CLICKED', 'COMPLETED', 'DISMISSED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `rating` INTEGER NULL,
    `privateFeedback` VARCHAR(191) NULL,
    `feedbackStatus` ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `snoozeCount` INTEGER NOT NULL DEFAULT 0,
    `eligibleAt` DATETIME(3) NOT NULL,
    `shownAt` DATETIME(3) NULL,
    `ratedAt` DATETIME(3) NULL,
    `clickedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReviewRequest_appointmentId_key`(`appointmentId`),
    INDEX `ReviewRequest_localId_status_createdAt_idx`(`localId`, `status`, `createdAt`),
    INDEX `ReviewRequest_localId_userId_createdAt_idx`(`localId`, `userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReviewProgramConfig` ADD CONSTRAINT `ReviewProgramConfig_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_localId_fkey` FOREIGN KEY (`localId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewRequest` ADD CONSTRAINT `ReviewRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
