-- Drop/Add FK only if ClientNote exists (avoid shadow DB failures)
SET @clientnote_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'ClientNote'
);

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'ClientNote'
    AND constraint_name = 'ClientNote_userId_fkey'
    AND constraint_type = 'FOREIGN KEY'
);

SET @drop_fk_sql := IF(
  @clientnote_exists > 0 AND @fk_exists > 0,
  'ALTER TABLE `ClientNote` DROP FOREIGN KEY `ClientNote_userId_fkey`',
  'SELECT 1'
);
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_fk_sql := IF(
  @clientnote_exists > 0,
  'ALTER TABLE `ClientNote` ADD CONSTRAINT `ClientNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @add_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
