CREATE INDEX `reservations_hotel_id_check_in_date_idx`
  ON `reservations`(`hotel_id`, `check_in_date`);

CREATE INDEX `reservations_hotel_id_check_out_date_idx`
  ON `reservations`(`hotel_id`, `check_out_date`);
