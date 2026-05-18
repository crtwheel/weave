// Weave Supabase client
const supabaseClient = supabase.createClient(
  WEAVE_CONFIG.SUPABASE_URL,
  WEAVE_CONFIG.SUPABASE_ANON_KEY
);
