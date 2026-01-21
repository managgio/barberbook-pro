/*
  Warnings:

  - Made the column `subdomain` on table `Brand` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Brand` MODIFY `subdomain` VARCHAR(191) NOT NULL;
