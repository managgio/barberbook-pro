ALTER TABLE `notification_deliveries`
  MODIFY COLUMN `status` ENUM(
    'pending',
    'processing',
    'accepted',
    'sent',
    'delivered',
    'undelivered',
    'retrying',
    'failed',
    'skipped'
  ) NOT NULL DEFAULT 'pending',
  ADD COLUMN `activeAttemptReference` VARCHAR(64) NULL AFTER `processingStartedAt`,
  ADD COLUMN `sentAt` DATETIME(3) NULL AFTER `acceptedAt`,
  ADD COLUMN `deliveredAt` DATETIME(3) NULL AFTER `sentAt`,
  ADD COLUMN `undeliveredAt` DATETIME(3) NULL AFTER `deliveredAt`,
  ADD COLUMN `deliveryStatusUpdatedAt` DATETIME(3) NULL AFTER `undeliveredAt`,
  ADD UNIQUE INDEX `nd_active_attempt_reference_key` (`activeAttemptReference`),
  ADD INDEX `nd_channel_provider_message_idx` (`channel`, `providerMessageId`);

UPDATE `BrandConfig`
SET `data` = JSON_REMOVE(`data`, '$.twilio')
WHERE JSON_CONTAINS_PATH(`data`, 'one', '$.twilio') = 1;

UPDATE `LocationConfig`
SET `data` = JSON_REMOVE(`data`, '$.twilio')
WHERE JSON_CONTAINS_PATH(`data`, 'one', '$.twilio') = 1;

-- SMS real starts fail-closed. Platform must explicitly enable each brand after
-- the global sender, callback and budget have been verified.
UPDATE `BrandConfig`
SET `data` = JSON_SET(
  `data`,
  '$.notificationPrefs',
  JSON_SET(
    COALESCE(JSON_EXTRACT(`data`, '$.notificationPrefs'), JSON_OBJECT()),
    '$.sms',
    JSON_EXTRACT('false', '$')
  )
);

-- Remove inherited local values so a future explicit brand enablement behaves
-- consistently unless Platform creates a fresh local override afterwards.
UPDATE `LocationConfig`
SET `data` = JSON_REMOVE(`data`, '$.notificationPrefs.sms')
WHERE JSON_CONTAINS_PATH(`data`, 'one', '$.notificationPrefs.sms') = 1;
