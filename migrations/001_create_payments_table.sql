-- Migration: 001_create_payments_table.sql
-- Create payments table to track Razorpay orders, status, and verification
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'created', -- 'created', 'pending', 'paid', 'failed'
  gateway VARCHAR(20) DEFAULT 'razorpay',
  gateway_order_id VARCHAR(100) UNIQUE,
  gateway_payment_id VARCHAR(100),
  gateway_signature VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_rider_id ON payments(rider_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments(gateway_order_id);
