-- Migration 002: Add Ride OTP, Live Tracking Coordinates, Driver Details, and Ratings

-- 1. Extend 'rides' table with OTP, Live Tracking coordinates, Bill and Rating columns
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10) DEFAULT '4829',
  ADD COLUMN IF NOT EXISTS driver_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS driver_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS driver_eta_minutes INT,
  ADD COLUMN IF NOT EXISTS rating INT,
  ADD COLUMN IF NOT EXISTS feedback_tags TEXT[],
  ADD COLUMN IF NOT EXISTS review_comment TEXT,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'upi_qr',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

-- 2. Extend 'profiles' table with vehicle details, verified UPI ID, driver rating, and current coordinates
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100) DEFAULT 'White Maruti Swift Dzire',
  ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50) DEFAULT 'MH 15 AB 1234',
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100) DEFAULT 'cabgo.driver@okhdfcbank',
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 4.90,
  ADD COLUMN IF NOT EXISTS total_ratings INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION DEFAULT 20.0050,
  ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION DEFAULT 73.7850;

-- 3. Update any existing driver profiles with realistic vehicle and UPI info
UPDATE profiles
SET
  vehicle_model = COALESCE(vehicle_model, 'White Maruti Swift Dzire'),
  vehicle_number = COALESCE(vehicle_number, 'MH 15 AB 1234'),
  upi_id = COALESCE(upi_id, 'cabgo.driver@okhdfcbank'),
  rating = COALESCE(rating, 4.90),
  total_ratings = COALESCE(total_ratings, 24)
WHERE role = 'driver';

-- 4. Update any existing rides without OTP to have a valid 4-digit code
UPDATE rides
SET otp_code = '4829'
WHERE otp_code IS NULL;
