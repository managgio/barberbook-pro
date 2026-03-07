-- Referral code lookups by tenant and recency
SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'ReferralCode'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'ReferralCode' AND index_name = 'ReferralCode_localId_createdAt_idx'
    ),
    'CREATE INDEX `ReferralCode_localId_createdAt_idx` ON `ReferralCode`(`localId`, `createdAt`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Reward transaction streams by tenant/state/time
SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'RewardTransaction'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'RewardTransaction' AND index_name = 'RewardTransaction_localId_status_createdAt_idx'
    ),
    'CREATE INDEX `RewardTransaction_localId_status_createdAt_idx` ON `RewardTransaction`(`localId`, `status`, `createdAt`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Cash register time-range scans per tenant (table appears in later migration on clean installs)
SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'CashMovement'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'CashMovement' AND index_name = 'CashMovement_localId_occurredAt_idx'
    ),
    'CREATE INDEX `CashMovement_localId_occurredAt_idx` ON `CashMovement`(`localId`, `occurredAt`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'CashMovement'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'CashMovement' AND index_name = 'CashMovement_localId_createdAt_idx'
    ),
    'CREATE INDEX `CashMovement_localId_createdAt_idx` ON `CashMovement`(`localId`, `createdAt`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Client note timelines by tenant/client (table appears in later migration on clean installs)
SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'ClientNote'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'ClientNote' AND index_name = 'ClientNote_localId_userId_createdAt_idx'
    ),
    'CREATE INDEX `ClientNote_localId_userId_createdAt_idx` ON `ClientNote`(`localId`, `userId`, `createdAt`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Observability dashboards by tenant/time
SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'web_vital_events'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'web_vital_events' AND index_name = 'web_vital_events_localId_timestamp_idx'
    ),
    'CREATE INDEX `web_vital_events_localId_timestamp_idx` ON `web_vital_events`(`localId`, `timestamp`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_index_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'api_metric_events'
    ) AND NOT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'api_metric_events' AND index_name = 'api_metric_events_localId_timestamp_idx'
    ),
    'CREATE INDEX `api_metric_events_localId_timestamp_idx` ON `api_metric_events`(`localId`, `timestamp`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
