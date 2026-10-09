-- CreateTable
CREATE TABLE `housekeeping_task_photos` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `data` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `housekeeping_task_photos_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `housekeeping_task_photos`
ADD CONSTRAINT `housekeeping_task_photos_task_id_fkey`
FOREIGN KEY (`task_id`)
REFERENCES `housekeeping_tasks`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;