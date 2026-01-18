-- DropForeignKey
ALTER TABLE `ClientNote` DROP FOREIGN KEY `ClientNote_userId_fkey`;

-- AddForeignKey
ALTER TABLE `ClientNote` ADD CONSTRAINT `ClientNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
