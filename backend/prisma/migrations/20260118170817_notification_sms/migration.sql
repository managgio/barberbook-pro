SET @db := DATABASE();
SET @client_note_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ClientNote'
);
SET @client_note_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'ClientNote'
    AND CONSTRAINT_NAME = 'ClientNote_userId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @drop_fk_sql := IF(
  @client_note_exists > 0 AND @client_note_fk_exists > 0,
  'ALTER TABLE `ClientNote` DROP FOREIGN KEY `ClientNote_userId_fkey`;',
  'SELECT 1;'
);
PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

SET @add_fk_sql := IF(
  @client_note_exists > 0 AND @client_note_fk_exists = 0,
  'ALTER TABLE `ClientNote` ADD CONSTRAINT `ClientNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
  'SELECT 1;'
);
PREPARE add_fk_stmt FROM @add_fk_sql;
EXECUTE add_fk_stmt;
DEALLOCATE PREPARE add_fk_stmt;
