UPDATE `housekeeping_tasks`
SET `status` = 'PENDING'
WHERE `status` = 'IN_REVIEW';

ALTER TABLE `housekeeping_tasks`
  MODIFY `status` ENUM('PENDING', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'PENDING';
