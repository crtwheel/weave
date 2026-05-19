-- Weave Database Schema
-- Complete schema for the crypto-paid Tailwind template marketplace.
-- Tables, migration ALTERs, indexes, RLS policies, and storage RLS.

----------------------------------------------------------------------
-- 0. HELPER FUNCTIONS
----------------------------------------------------------------------

-- Check if the current user has an admin or superadmin role.
-- Uses SECURITY DEFINER to bypass RLS on profiles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
END;
$$;

----------------------------------------------------------------------
-- 1. CATEGORIES
-- Lookup table for template categories (e.g. "landing-page", "dashboard")
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

----------------------------------------------------------------------
-- 2. PROFILES
-- Auto-created on user signup. Extended with role, avatar, etc.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  discord_username TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  banned_at TIMESTAMPTZ,
  avatar_url TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration columns for existing installations
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

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

----------------------------------------------------------------------
-- 3. TEMPLATES
-- Product catalog — each row is a downloadable Tailwind template
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_usd NUMERIC(6,2) NOT NULL DEFAULT 29.00,
  price_eth NUMERIC(10,8) NOT NULL DEFAULT 0.01,
  storage_path TEXT NOT NULL,
  preview_url TEXT,
  category_slug TEXT REFERENCES categories(slug),
  tags TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  version TEXT DEFAULT '1.0.0',
  downloads INTEGER DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  popular BOOLEAN DEFAULT false,
  trending BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration columns for existing installations
ALTER TABLE templates ADD COLUMN IF NOT EXISTS category_slug TEXT REFERENCES categories(slug);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0.0;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS popular BOOLEAN DEFAULT false;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS trending BOOLEAN DEFAULT false;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

----------------------------------------------------------------------
-- 4. PURCHASES
-- One row per verified blockchain transaction
----------------------------------------------------------------------
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

----------------------------------------------------------------------
-- 5. FAVORITES
-- Bookmark a template for quick access
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  template_id BIGINT REFERENCES templates(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

----------------------------------------------------------------------
-- 6. RATINGS
-- User rating (1-5) per template
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  template_id BIGINT REFERENCES templates(id) NOT NULL,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

----------------------------------------------------------------------
-- 7. COLLECTIONS
-- User-created curated sets of templates
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

----------------------------------------------------------------------
-- 8. COLLECTION ITEMS
-- Templates belonging to a collection
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_items (
  id BIGSERIAL PRIMARY KEY,
  collection_id BIGINT REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  template_id BIGINT REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, template_id)
);

----------------------------------------------------------------------
-- 9. DOWNLOAD LOGS
-- Tracks every successful template download
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS download_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  template_id BIGINT REFERENCES templates(id) NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

----------------------------------------------------------------------
-- 10. AUDIT LOGS
-- Admin action trail (immutable after insert)
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES profiles(id) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

----------------------------------------------------------------------
-- 11. FEATURE FLAGS
-- Toggles for in-app functionality, controlled by admins
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

----------------------------------------------------------------------
-- 12. ANNOUNCEMENTS
-- Site-wide notices broadcast to users
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'success', 'error')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

----------------------------------------------------------------------
-- 13. INDEXES
----------------------------------------------------------------------

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_category_slug ON templates(category_slug);
CREATE INDEX IF NOT EXISTS idx_templates_published ON templates(published);
CREATE INDEX IF NOT EXISTS idx_templates_popular ON templates(popular) WHERE popular = true;
CREATE INDEX IF NOT EXISTS idx_templates_trending ON templates(trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON templates(updated_at DESC);

-- Purchases
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_tx_hash ON purchases(tx_hash);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_template_id ON purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

-- Favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_template_id ON favorites(template_id);

-- Ratings
CREATE INDEX IF NOT EXISTS idx_ratings_template_id ON ratings(template_id);

-- Collections
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_is_public ON collections(is_public) WHERE is_public = true;

-- Collection items
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_template_id ON collection_items(template_id);

-- Download logs
CREATE INDEX IF NOT EXISTS idx_download_logs_user_id ON download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_template_id ON download_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_created_at ON download_logs(created_at DESC);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

----------------------------------------------------------------------
-- 14. ENABLE ROW LEVEL SECURITY
----------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- 15. RLS POLICIES
----------------------------------------------------------------------

-- 15a. PROFILES
-- Users read/update own row. Admins read/update any row.
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
CREATE POLICY "admins_read_all_profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_all_profiles" ON profiles;
CREATE POLICY "admins_update_all_profiles"
  ON profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 15b. TEMPLATES
-- Anyone can browse. Only admins can modify the catalog.
DROP POLICY IF EXISTS "anyone_read_templates" ON templates;
CREATE POLICY "anyone_read_templates"
  ON templates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admins_insert_templates" ON templates;
CREATE POLICY "admins_insert_templates"
  ON templates FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_templates" ON templates;
CREATE POLICY "admins_update_templates"
  ON templates FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_templates" ON templates;
CREATE POLICY "admins_delete_templates"
  ON templates FOR DELETE
  USING (public.is_admin());

-- 15c. PURCHASES
-- Users see and insert their own purchases. Admins manage all.
DROP POLICY IF EXISTS "users_read_own_purchases" ON purchases;
CREATE POLICY "users_read_own_purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_purchases" ON purchases;
CREATE POLICY "users_insert_own_purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_all_purchases" ON purchases;
CREATE POLICY "admins_all_purchases"
  ON purchases FOR ALL
  USING (public.is_admin());

-- 15d. FAVORITES
-- Users manage their own favorites. Admins manage all.
DROP POLICY IF EXISTS "users_select_own_favorites" ON favorites;
CREATE POLICY "users_select_own_favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_favorites" ON favorites;
CREATE POLICY "users_insert_own_favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_favorites" ON favorites;
CREATE POLICY "users_update_own_favorites"
  ON favorites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_favorites" ON favorites;
CREATE POLICY "users_delete_own_favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_all_favorites" ON favorites;
CREATE POLICY "admins_all_favorites"
  ON favorites FOR ALL
  USING (public.is_admin());

-- 15e. RATINGS
-- Users manage their own ratings. Anyone can read (for averages).
DROP POLICY IF EXISTS "anyone_read_ratings" ON ratings;
CREATE POLICY "anyone_read_ratings"
  ON ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "users_insert_own_ratings" ON ratings;
CREATE POLICY "users_insert_own_ratings"
  ON ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_ratings" ON ratings;
CREATE POLICY "users_update_own_ratings"
  ON ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_ratings" ON ratings;
CREATE POLICY "users_delete_own_ratings"
  ON ratings FOR DELETE
  USING (auth.uid() = user_id);

-- 15f. COLLECTIONS
-- Users manage their own collections. Anyone can read public ones.
DROP POLICY IF EXISTS "users_select_own_collections" ON collections;
CREATE POLICY "users_select_own_collections"
  ON collections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_collections" ON collections;
CREATE POLICY "users_insert_own_collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_collections" ON collections;
CREATE POLICY "users_update_own_collections"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_collections" ON collections;
CREATE POLICY "users_delete_own_collections"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anyone_read_public_collections" ON collections;
CREATE POLICY "anyone_read_public_collections"
  ON collections FOR SELECT
  USING (is_public = true);

-- 15g. COLLECTION ITEMS
-- Users manage items in their own collections (ownership via the parent collection).
DROP POLICY IF EXISTS "users_select_own_collection_items" ON collection_items;
CREATE POLICY "users_select_own_collection_items"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND collections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_insert_own_collection_items" ON collection_items;
CREATE POLICY "users_insert_own_collection_items"
  ON collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND collections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_delete_own_collection_items" ON collection_items;
CREATE POLICY "users_delete_own_collection_items"
  ON collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Allow reading items that belong to public collections
DROP POLICY IF EXISTS "anyone_read_public_collection_items" ON collection_items;
CREATE POLICY "anyone_read_public_collection_items"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND collections.is_public = true
    )
  );

-- 15h. DOWNLOAD LOGS
-- Users see their own logs. Insert is scoped to current user. Admins see all.
DROP POLICY IF EXISTS "users_select_own_download_logs" ON download_logs;
CREATE POLICY "users_select_own_download_logs"
  ON download_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_download_logs" ON download_logs;
CREATE POLICY "users_insert_download_logs"
  ON download_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_all_download_logs" ON download_logs;
CREATE POLICY "admins_all_download_logs"
  ON download_logs FOR ALL
  USING (public.is_admin());

-- 15i. AUDIT LOGS
-- Admins only — full access.
DROP POLICY IF EXISTS "admins_all_audit_logs" ON audit_logs;
CREATE POLICY "admins_all_audit_logs"
  ON audit_logs FOR ALL
  USING (public.is_admin());

-- 15j. FEATURE FLAGS
-- Anyone can read current flag state. Only admins can modify.
DROP POLICY IF EXISTS "anyone_read_feature_flags" ON feature_flags;
CREATE POLICY "anyone_read_feature_flags"
  ON feature_flags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admins_all_feature_flags" ON feature_flags;
CREATE POLICY "admins_all_feature_flags"
  ON feature_flags FOR ALL
  USING (public.is_admin());

-- 15k. ANNOUNCEMENTS
-- Anyone can read active announcements. Admins have full CRUD.
DROP POLICY IF EXISTS "anyone_read_announcements" ON announcements;
CREATE POLICY "anyone_read_announcements"
  ON announcements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admins_insert_announcements" ON announcements;
CREATE POLICY "admins_insert_announcements"
  ON announcements FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_announcements" ON announcements;
CREATE POLICY "admins_update_announcements"
  ON announcements FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_announcements" ON announcements;
CREATE POLICY "admins_delete_announcements"
  ON announcements FOR DELETE
  USING (public.is_admin());

----------------------------------------------------------------------
-- 16. STORAGE — TEMPLATE-FILES BUCKET
-- Private bucket; download allowed only if user has a verified
-- purchase for the requested template.
-- Run in Supabase Dashboard SQL Editor if migrations target the
-- storage schema separately.
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('template-files', 'template-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "download_verified_purchases" ON storage.objects;
CREATE POLICY "download_verified_purchases"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'template-files'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM purchases p
      JOIN templates t ON p.template_id = t.id
      WHERE p.user_id = auth.uid()
        AND p.status = 'verified'
        AND t.storage_path = storage.objects.name
    )
  );

----------------------------------------------------------------------
-- 17. COMMUNITY: Comments/Reviews
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  template_id BIGINT REFERENCES templates(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_template ON comments(template_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

----------------------------------------------------------------------
-- 18. SUPPORT TICKETS
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs ON ticket_messages(ticket_id);

----------------------------------------------------------------------
-- 19. BUSINESS LISTINGS
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_listings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  website TEXT,
  contact_email TEXT,
  category TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_approved ON business_listings(approved);

----------------------------------------------------------------------
-- 20. ADVERTISING SYSTEM
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'sidebar' CHECK (placement IN ('sidebar', 'banner', 'inline')),
  impressions INT DEFAULT 0,
  max_impressions INT DEFAULT 1000,
  clicks INT DEFAULT 0,
  eth_price NUMERIC(10,8) DEFAULT 0.01,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ads_placement ON ads(placement);

----------------------------------------------------------------------
-- 21. ENABLE RLS ON NEW TABLES
----------------------------------------------------------------------
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- 22. RLS POLICIES FOR NEW TABLES
----------------------------------------------------------------------

-- 22a. COMMENTS
DROP POLICY IF EXISTS "comments_read_all" ON comments;
CREATE POLICY "comments_read_all" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (auth.uid() = user_id);

-- 22b. TICKETS
DROP POLICY IF EXISTS "tickets_select_own" ON tickets;
CREATE POLICY "tickets_select_own" ON tickets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tickets_insert_own" ON tickets;
CREATE POLICY "tickets_insert_own" ON tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tickets_update_own" ON tickets;
CREATE POLICY "tickets_update_own" ON tickets FOR UPDATE USING (auth.uid() = user_id);

-- 22c. TICKET MESSAGES
DROP POLICY IF EXISTS "ticket_msgs_select" ON ticket_messages;
CREATE POLICY "ticket_msgs_select" ON ticket_messages FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ticket_msgs_insert" ON ticket_messages;
CREATE POLICY "ticket_msgs_insert" ON ticket_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 22d. BUSINESS LISTINGS
DROP POLICY IF EXISTS "listings_read_approved" ON business_listings;
CREATE POLICY "listings_read_approved" ON business_listings FOR SELECT USING (approved = true OR auth.uid() = user_id);
DROP POLICY IF EXISTS "listings_insert_own" ON business_listings;
CREATE POLICY "listings_insert_own" ON business_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "listings_update_own" ON business_listings;
CREATE POLICY "listings_update_own" ON business_listings FOR UPDATE USING (auth.uid() = user_id);

-- 22e. ADS
DROP POLICY IF EXISTS "ads_read_active" ON ads;
CREATE POLICY "ads_read_active" ON ads FOR SELECT USING (active = true);
