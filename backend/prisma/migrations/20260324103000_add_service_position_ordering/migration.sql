ALTER TABLE `Service`
  ADD COLUMN `position` INT NOT NULL DEFAULT 0;

WITH ordered_services AS (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `localId`, `categoryId`
      ORDER BY `name` ASC, `createdAt` ASC
    ) - 1 AS next_position
  FROM `Service`
)
UPDATE `Service` s
JOIN ordered_services o ON o.id = s.id
SET s.`position` = o.next_position;

CREATE INDEX `Service_localId_categoryId_position_idx`
  ON `Service`(`localId`, `categoryId`, `position`);
