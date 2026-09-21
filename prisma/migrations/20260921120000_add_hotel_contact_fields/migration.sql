-- These columns already exist in the database. This migration records the schema change for new environments.
ALTER TABLE `hotels`
  ADD COLUMN `address` VARCHAR(191) NULL,
  ADD COLUMN `check_in_time` VARCHAR(191) NULL,
  ADD COLUMN `check_out_time` VARCHAR(191) NULL,
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD COLUMN `phone` VARCHAR(191) NULL;

ALTER TABLE `rooms`
  ADD COLUMN `floor` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `capacity` INTEGER NOT NULL DEFAULT 1;
