-- CreateTable
CREATE TABLE `provider_usage_daily` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('openai', 'twilio', 'imagekit') NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `date_key` VARCHAR(191) NOT NULL,
    `costUsd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `tokens_input` INTEGER NOT NULL DEFAULT 0,
    `tokens_output` INTEGER NOT NULL DEFAULT 0,
    `tokens_total` INTEGER NOT NULL DEFAULT 0,
    `messages_count` INTEGER NOT NULL DEFAULT 0,
    `storage_used_bytes` BIGINT NOT NULL DEFAULT 0,
    `storage_limit_bytes` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_usage_daily_provider_date_key_idx`(`provider`, `date_key`),
    INDEX `provider_usage_daily_brandId_idx`(`brandId`),
    UNIQUE INDEX `provider_usage_daily_provider_brandId_date_key_key`(`provider`, `brandId`, `date_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `provider_usage_daily` ADD CONSTRAINT `provider_usage_daily_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
