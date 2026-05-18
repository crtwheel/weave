-- Weave Database Schema

-- Profiles table (auto-created on user signup via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  discord_username TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Templates table (product catalog)
CREATE TABLE IF NOT EXISTS templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_usd NUMERIC(6,2) NOT NULL DEFAULT 29.00,
  price_eth NUMERIC(10,8) NOT NULL DEFAULT 0.01,
  storage_path TEXT NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases table (one per verified transaction)
CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  template_id BIGINT REFERENCES templates(id) NOT NULL,
  tx_hash TEXT NOT NULL,
  sender_wallet TEXT NOT NULL,
  discord_username TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'refunded')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_tx_hash ON purchases(tx_hash);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_template_id ON purchases(template_id);

-- Status updates (pending->verified/rejected) done by seller via Supabase Studio
-- which uses service_role key and bypasses RLS. No client-side UPDATE policy needed.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Profiles: users read/update only their own
CREATE POLICY "users_read_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Templates: anyone can read (product catalog)
CREATE POLICY "anyone_read_templates"
  ON templates FOR SELECT
  USING (true);

-- Purchases: users see only their own
CREATE POLICY "users_read_own_purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Purchases: authenticated users can insert their own
CREATE POLICY "users_insert_own_purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);
