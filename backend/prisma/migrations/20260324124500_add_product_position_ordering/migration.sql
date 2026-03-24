ALTER TABLE `Product`
  ADD COLUMN `position` INT NOT NULL DEFAULT 0;

WITH ordered_products AS (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `localId`, `categoryId`
      ORDER BY `name` ASC, `createdAt` ASC
    ) - 1 AS next_position
  FROM `Product`
)
UPDATE `Product` p
JOIN ordered_products o ON o.id = p.id
SET p.`position` = o.next_position;

CREATE INDEX `Product_localId_categoryId_position_idx`
  ON `Product`(`localId`, `categoryId`, `position`);
