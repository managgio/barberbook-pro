-- Keep historical messaging rows explicitly unclassified because legacy records
-- may contain both SMS and WhatsApp usage and cannot be separated reliably.
ALTER TABLE `provider_usage_daily`
    ADD COLUMN `usage_channel` ENUM('general', 'sms', 'whatsapp') NOT NULL DEFAULT 'general';

DROP INDEX `provider_usage_daily_provider_date_key_idx` ON `provider_usage_daily`;
DROP INDEX `provider_usage_daily_provider_brandId_date_key_key` ON `provider_usage_daily`;

CREATE INDEX `provider_usage_daily_provider_usage_channel_date_key_idx`
    ON `provider_usage_daily`(`provider`, `usage_channel`, `date_key`);

CREATE UNIQUE INDEX `provider_usage_daily_provider_usage_channel_brandId_date_key_key`
    ON `provider_usage_daily`(`provider`, `usage_channel`, `brandId`, `date_key`);
