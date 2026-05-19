// Weave Configuration — Template for deployments
// Copy this to config.js and fill in your Supabase credentials.
// WALLET_ADDRESS is the Ethereum address that receives template payments.
// SITE_URL should match your deployment domain (no trailing slash).

const WEAVE_CONFIG = {
  SUPABASE_URL: '{{SUPABASE_URL}}',
  SUPABASE_ANON_KEY: '{{SUPABASE_ANON_KEY}}',
  WALLET_ADDRESS: '0xbe9Db9c86B79617231a4861fb54ef278447D43fb',
  SITE_NAME: 'Weave',
  SITE_DESCRIPTION: 'Premium Tailwind templates. Pay with Crypto.',
  SITE_URL: 'https://crtwheel.github.io/weave',
  SUPPORT_EMAIL: 'support@weave.io',
  DOWNLOAD_EXPIRY: 3600,
  TEMPLATES_PER_PAGE: 12,
  FEATURED_COUNT: 6,
  TRENDING_COUNT: 6,
  CACHE_TTL: 300000,
};
