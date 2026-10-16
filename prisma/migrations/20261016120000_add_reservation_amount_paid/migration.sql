ALTER TABLE `reservations`
  ADD COLUMN `amount_paid` DECIMAL(10, 2) NULL;

UPDATE `reservations`
SET `amount_paid` = CASE
  WHEN `payment_status` = 'PAID' THEN `total_price`
  WHEN `payment_status` = 'UNPAID' THEN 0.00
  ELSE NULL
END;