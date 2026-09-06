-- CreateTable
CREATE TABLE `hotels` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Beirut',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
