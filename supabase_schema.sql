-- Sentinel Cinema DRM Database Schema
-- Run this in your Supabase SQL Editor to provision tables and seed initial data.

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT 'sentinel123',
  role TEXT CHECK (role IN ('STUDIO_CLIENT', 'SUPER_ADMIN')) DEFAULT 'STUDIO_CLIENT',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  trial_uses_remaining INT DEFAULT 2,
  device_fingerprint_hash TEXT,
  company_name TEXT,
  gstin TEXT,
  subscription_tier TEXT CHECK (subscription_tier IN ('Silver', 'Gold', 'Platinum')) DEFAULT 'Gold',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Movies Table
CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  tracking_status TEXT CHECK (tracking_status IN ('Secure', 'Breached')) DEFAULT 'Secure',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Theatre Screens Table
CREATE TABLE IF NOT EXISTS theatre_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  chain_name TEXT NOT NULL,
  city TEXT NOT NULL,
  screen_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Leak Alerts Table
CREATE TABLE IF NOT EXISTS leak_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  theatre_id UUID REFERENCES theatre_screens(id) ON DELETE CASCADE,
  payload_string TEXT NOT NULL,
  status TEXT CHECK (status IN ('Active', 'Takedown Dispatched')) DEFAULT 'Active',
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 5. Billing Ledgers Table
CREATE TABLE IF NOT EXISTS billing_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_retainer_due NUMERIC DEFAULT 300000,
  screen_fees NUMERIC DEFAULT 0,
  bounty_rewards NUMERIC DEFAULT 0,
  payment_status TEXT CHECK (payment_status IN ('Unpaid', 'Paid_Razorpay', 'Paid_Bank', 'Verification_Pending')) DEFAULT 'Unpaid',
  bank_utr TEXT,
  bank_receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Global Configuration Table
CREATE TABLE IF NOT EXISTS global_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Enforce single config row
  base_retainer_price NUMERIC DEFAULT 300000,
  screen_fee_price NUMERIC DEFAULT 20000,
  bounty_reward_price NUMERIC DEFAULT 60000,
  css_primary_color TEXT DEFAULT '#3b82f6'
);

-- Row Level Security (RLS) Configurations
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE leak_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_config ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon access to all tables (for demo/development convenience)
CREATE POLICY "Public Read Access" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON movies FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON theatre_screens FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON leak_alerts FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON billing_ledgers FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON global_config FOR SELECT USING (true);

CREATE POLICY "Public All Operations" ON profiles FOR ALL USING (true);
CREATE POLICY "Public All Operations" ON movies FOR ALL USING (true);
CREATE POLICY "Public All Operations" ON theatre_screens FOR ALL USING (true);
CREATE POLICY "Public All Operations" ON leak_alerts FOR ALL USING (true);
CREATE POLICY "Public All Operations" ON billing_ledgers FOR ALL USING (true);
CREATE POLICY "Public All Operations" ON global_config FOR ALL USING (true);

-- Seed Initial Global Config
INSERT INTO global_config (id, base_retainer_price, screen_fee_price, bounty_reward_price, css_primary_color)
VALUES (1, 300000, 20000, 60000, '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Profiles
INSERT INTO profiles (email, password, role, onboarding_completed, trial_uses_remaining, device_fingerprint_hash, company_name, gstin, subscription_tier)
VALUES 
  ('demo@kiteandtail.com', 'sentinel123', 'STUDIO_CLIENT', TRUE, 999, 'FP_DEMO_OK', 'Kite & Tail Demo', '27AAAAA3333C1Z3', 'Platinum'),
  ('producer@kiteandtail.com', 'sentinel123', 'STUDIO_CLIENT', TRUE, 1, 'FP_CLIENT_OK', 'Kite & Tail Studios', '27AAAAA1111A1Z1', 'Gold'),
  ('admin@kiteandtail.com', 'admin123', 'SUPER_ADMIN', TRUE, 0, 'FP_ADMIN_OK', 'Kite & Tail Ops', '27AAAAA2222B1Z2', 'Platinum'),
  ('abuser@flagged.com', 'sentinel123', 'STUDIO_CLIENT', FALSE, 0, 'FP_ABUSE_LOCKED', NULL, NULL, 'Gold')
ON CONFLICT (email) DO NOTHING;
