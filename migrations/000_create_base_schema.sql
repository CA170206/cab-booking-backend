-- Migration 000: Base schema for RideGo / CabGo
-- Creates extension, profiles table, rides table, and backwards compatibility views

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(20) NOT NULL DEFAULT 'rider',
  password_hash VARCHAR(255),
  vehicle_model VARCHAR(100) DEFAULT 'White Maruti Swift Dzire',
  vehicle_number VARCHAR(50) DEFAULT 'MH 15 AB 1234',
  upi_id VARCHAR(100) DEFAULT 'ridego.driver@okhdfcbank',
  rating NUMERIC(3,2) DEFAULT 4.90,
  total_ratings INT DEFAULT 24,
  current_lat DOUBLE PRECISION DEFAULT 20.0050,
  current_lng DOUBLE PRECISION DEFAULT 73.7850,
  emergency_phone VARCHAR(50),
  home_address TEXT,
  work_address TEXT,
  preferred_payment VARCHAR(50),
  preferred_vehicle VARCHAR(50),
  license_number VARCHAR(100),
  vehicle_category VARCHAR(50),
  service_area VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. Rides Table
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  distance_km NUMERIC(6,2),
  duration_minutes INT,
  estimated_fare NUMERIC(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'requested',
  otp_code VARCHAR(10) DEFAULT '4829',
  driver_lat DOUBLE PRECISION,
  driver_lng DOUBLE PRECISION,
  driver_eta_minutes INT,
  rating INT,
  feedback_tags TEXT[],
  review_comment TEXT,
  payment_method VARCHAR(50) DEFAULT 'upi_qr',
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  passenger_name VARCHAR(255),
  passenger_phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);

-- 3. Compatibility layer: Safe migration from existing 'users' table if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    INSERT INTO profiles (id, full_name, email, phone, role, password_hash, created_at)
    SELECT
      id,
      COALESCE(full_name, name, email) AS full_name,
      email,
      phone,
      COALESCE(role, 'rider') AS role,
      COALESCE(password_hash, password) AS password_hash,
      COALESCE(created_at, NOW()) AS created_at
    FROM users
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;

-- 4. Compatibility layer: Ensure 'users' view exists for any queries expecting a users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    CREATE OR REPLACE VIEW users AS SELECT * FROM profiles;
  END IF;
END $$;

