CREATE INDEX `housekeeping_tasks_hotel_id_created_at_idx`
  ON `housekeeping_tasks` (`hotel_id`, `created_at`);

CREATE INDEX `housekeeping_tasks_hotel_id_assigned_to_user_id_created_at_idx`
  ON `housekeeping_tasks` (`hotel_id`, `assigned_to_user_id`, `created_at`);

CREATE INDEX `housekeeping_tasks_hotel_id_status_idx`
  ON `housekeeping_tasks` (`hotel_id`, `status`);
