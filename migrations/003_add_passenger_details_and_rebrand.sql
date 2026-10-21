-- Migration 003: Add passenger contact details to rides and update UPI branding
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS passenger_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS passenger_phone VARCHAR(50);

-- Update default driver UPI to ridego
UPDATE profiles
SET upi_id = 'ridego.driver@okhdfcbank'
WHERE upi_id = 'cabgo.driver@okhdfcbank';
