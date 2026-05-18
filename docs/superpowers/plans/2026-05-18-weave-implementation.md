# Weave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy Weave — a crypto-paid Tailwind CSS template shop on GitHub Pages with Supabase backend.

**Architecture:** Static frontend (4 HTML pages + Tailwind CSS) served via GitHub Pages. Supabase handles auth, database, and file storage. Crypto payment is manual (buyer sends ETH/USDC to seller's wallet, submits form with tx hash, seller verifies on Etherscan). No payment processor, $0 monthly cost.

**Security:** Supabase anon key injected via GitHub Actions secrets at deploy time — never in the source repo. Template files stored in private Supabase Storage bucket with RLS — never in the git repo. Duplicate tx_hash prevented by unique constraint. Spoofed transactions prevented by seller's 4-point verification (checking sender address matches submission).

**Tech Stack:** HTML + Tailwind CSS (CDN), Supabase JS SDK, GitHub Pages, GitHub Actions

---

### Task 1: Supabase schema (tables, RLS, storage)

**Files:**
- Create: `supabase/schema.sql`
- Create: `supabase/storage-rls.sql`

- [ ] **Step 1: Create schema.sql**

```sql
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
  VALUES (NEW.id, NEW.email);
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

-- RLS Policies
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
```

- [ ] **Step 2: Create storage-rls.sql**

```sql
-- Create private bucket (run via Supabase Dashboard SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-files', 'template-files', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users with a verified purchase can download
CREATE POLICY "download_verified_purchases"
  ON storage.objects FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM purchases p
      JOIN templates t ON p.template_id = t.id
      WHERE p.user_id = auth.uid()
        AND p.status = 'verified'
        AND t.storage_path = storage.objects.name
    )
  );
```

- [ ] **Step 3: Apply the schema**
  - Go to https://supabase.com → Create a new project (free tier, no credit card needed)
  - In the SQL Editor, paste and run `schema.sql`
  - In the SQL Editor, paste and run `storage-rls.sql`
  - Note: your Supabase project URL and anon key — these will be used in Task 2

---

### Task 2: Project setup — .gitignore, config, GitHub Actions

**Files:**
- Create: `.gitignore`
- Create: `js/config.example.js`
- Create: `js/supabase-client.js`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .gitignore**

```
# Weave .gitignore

# Config files (contains Supabase URL/anon key — injected via CI)
js/config.js

# Template files (stored in Supabase Storage, not in repo)
templates/
*.zip

# OS junk
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

- [ ] **Step 2: Create js/config.example.js**

```js
// Weave configuration
// Copy this file to config.js and fill in your Supabase values.
// config.js is in .gitignore — never committed.
// For deployment, set SUPABASE_URL and SUPABASE_ANON_KEY as GitHub repo secrets.
const WEAVE_CONFIG = {
  SUPABASE_URL: '{{SUPABASE_URL}}',
  SUPABASE_ANON_KEY: '{{SUPABASE_ANON_KEY}}',
  WALLET_ADDRESS: '0xbe9Db9c86B79617231a4861fb54ef278447D43fb',
  SITE_NAME: 'Weave',
};
```

- [ ] **Step 3: Create js/supabase-client.js**

```js
// Weave Supabase client
const supabaseClient = supabase.createClient(
  WEAVE_CONFIG.SUPABASE_URL,
  WEAVE_CONFIG.SUPABASE_ANON_KEY
);
```

- [ ] **Step 4: Create .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Inject config
        run: |
          echo "const WEAVE_CONFIG = {
            SUPABASE_URL: '${{ secrets.SUPABASE_URL }}',
            SUPABASE_ANON_KEY: '${{ secrets.SUPABASE_ANON_KEY }}',
            WALLET_ADDRESS: '0xbe9Db9c86B79617231a4861fb54ef278447D43fb',
            SITE_NAME: 'Weave',
          };" > js/config.js
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Set up GitHub repo secrets**
  - Create a new repo on GitHub named `weave`
  - Go to Settings → Secrets and variables → Actions
  - Add `SUPABASE_URL` with your Supabase project URL
  - Add `SUPABASE_ANON_KEY` with your Supabase anon key

---

### Task 3: CSS — Tailwind theme and custom styles

**Files:**
- Create: `css/style.css`

- [ ] **Step 1: Create css/style.css**

```css
/* Weave Styles */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-card: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent: #f59e0b;
  --accent-hover: #d97706;
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

.font-mono {
  font-family: 'JetBrains Mono', monospace;
}

/* Header */
.site-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.nav-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--text-primary);
}

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
}

.card-preview {
  width: 100%;
  aspect-ratio: 16/10;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.card-body {
  padding: 1.25rem;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card-price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
}

.card-price-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 400;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--accent);
  color: #0f172a;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid rgba(255,255,255,0.15);
}

.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
}

/* Forms */
.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

/* Status badges */
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-pending {
  background: rgba(234,179,8,0.15);
  color: var(--warning);
}

.badge-verified {
  background: rgba(34,197,94,0.15);
  color: var(--success);
}

.badge-rejected {
  background: rgba(239,68,68,0.15);
  color: var(--error);
}

/* Layout utilities */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.page-section {
  padding: 4rem 0;
}

.text-center { text-align: center; }
.text-secondary { color: var(--text-secondary); }
.text-accent { color: var(--accent); }
.mt-1 { margin-top: 0.5rem; }
.mt-2 { margin-top: 1rem; }
.mt-4 { margin-top: 2rem; }
.mb-2 { margin-bottom: 1rem; }
.mb-4 { margin-bottom: 2rem; }
.gap-2 { gap: 1rem; }
.gap-4 { gap: 2rem; }
.flex { display: flex; }
.flex-wrap { flex-wrap: wrap; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.grid { display: grid; }
.grid-3 { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }

/* Wallet address */
.wallet-address {
  background: var(--bg-primary);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wallet-address .copy-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.wallet-address .copy-btn:hover {
  background: rgba(245,158,11,0.15);
}

/* Steps list */
.steps-list {
  list-style: none;
  counter-reset: step;
}

.steps-list li {
  counter-increment: step;
  padding: 1rem 0;
  padding-left: 3rem;
  position: relative;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.steps-list li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 1rem;
  width: 2rem;
  height: 2rem;
  background: var(--accent);
  color: #0f172a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
}

/* Dashboard table */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 0.9rem;
}

.data-table tr:last-child td {
  border-bottom: none;
}

/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, rgba(255,255,255,0.05) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Toast notification */
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 500;
  z-index: 100;
  animation: slideUp 0.3s ease;
  max-width: 400px;
}

.toast-success {
  background: #166534;
  color: #bbf7d0;
  border: 1px solid rgba(34,197,94,0.3);
}

.toast-error {
  background: #7f1d1d;
  color: #fecaca;
  border: 1px solid rgba(239,68,68,0.3);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* FAQ */
.faq-item {
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 1.25rem 0;
}

.faq-question {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.faq-answer {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
}

/* Page title */
.page-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--text-secondary);
  font-size: 1.05rem;
  margin-bottom: 2rem;
}

/* Footer */
.site-footer {
  background: var(--bg-secondary);
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 2rem 0;
  margin-top: 4rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .nav-links {
    gap: 1rem;
  }
  .page-title {
    font-size: 1.5rem;
  }
  .grid-3 {
    grid-template-columns: 1fr;
  }
  .toast {
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
    max-width: none;
  }
}
```

---

### Task 4: index.html — Product gallery

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weave — Premium Tailwind Templates</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/style.css">
  <script src="js/config.js"></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo">Weave</a>
      <nav class="nav-links">
        <a href="index.html">Products</a>
        <a href="faq.html">FAQ</a>
        <a href="dashboard.html">Dashboard</a>
      </nav>
    </div>
  </header>

  <section class="page-section">
    <div class="container">
      <h1 class="page-title">Premium Tailwind Templates</h1>
      <p class="page-subtitle">Clean, responsive landing pages. Built fast. Pay with crypto.</p>
      <div class="grid grid-3 gap-4" id="product-grid">
        <!-- Product cards loaded dynamically -->
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      &copy; 2026 Weave. Pay with ETH/USDC to wallet.<br>
      <span style="font-size:0.75rem;color:var(--text-secondary);">0xbe9Db9c86B79617231a4861fb54ef278447D43fb</span>
    </div>
  </footer>

  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
  <script>
    async function loadProducts() {
      const grid = document.getElementById('product-grid');
      grid.innerHTML = '<div class="skeleton" style="height:280px;"></div>'.repeat(3);

      try {
        const { data, error } = await supabaseClient
          .from('templates')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
          grid.innerHTML = '<p class="text-secondary" style="grid-column:1/-1;">No templates available yet. Check back soon.</p>';
          return;
        }

        grid.innerHTML = data.map(t => `
          <a href="product.html?slug=${t.slug}" class="card" style="text-decoration:none;color:inherit;">
            <div class="card-preview">
              ${t.preview_url
                ? `<img src="${t.preview_url}" alt="${t.name}" style="width:100%;height:100%;object-fit:cover;">`
                : 'Preview coming soon'}
            </div>
            <div class="card-body">
              <div class="card-title">${t.name}</div>
              <div class="text-secondary" style="font-size:0.85rem;margin-bottom:0.75rem;">${t.description || ''}</div>
              <div class="card-price">$${t.price_usd} <span class="card-price-sub">~${t.price_eth} ETH</span></div>
            </div>
          </a>
        `).join('');
      } catch (err) {
        grid.innerHTML = '<p class="text-secondary" style="grid-column:1/-1;">Failed to load products. Please try again later.</p>';
      }
    }

    document.addEventListener('DOMContentLoaded', loadProducts);
  </script>
</body>
</html>
```

---

### Task 5: product.html — Single product page with purchase form

**Files:**
- Create: `product.html`

- [ ] **Step 1: Create product.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product — Weave</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/style.css">
  <script src="js/config.js"></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo">Weave</a>
      <nav class="nav-links">
        <a href="index.html">Products</a>
        <a href="faq.html">FAQ</a>
        <a href="dashboard.html">Dashboard</a>
      </nav>
    </div>
  </header>

  <section class="page-section">
    <div class="container">
      <a href="index.html" class="btn btn-outline btn-sm mb-4">&larr; Back to Products</a>
      <div id="product-detail">
        <div class="skeleton" style="height:300px;margin-bottom:2rem;"></div>
        <div class="skeleton" style="height:40px;width:60%;margin-bottom:1rem;"></div>
        <div class="skeleton" style="height:20px;width:40%;"></div>
      </div>
    </div>
  </section>

  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
  <script src="js/purchase-form.js"></script>
  <script>
    async function loadProduct() {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('slug');

      if (!slug) {
        document.getElementById('product-detail').innerHTML = '<p class="text-secondary">No product specified. <a href="index.html" class="text-accent">Browse products.</a></p>';
        return;
      }

      try {
        const { data, error } = await supabaseClient
          .from('templates')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error || !data) throw error;

        document.getElementById('product-detail').innerHTML = `
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 3rem;">
            <div>
              <div class="card-preview" style="height:350px;">
                ${data.preview_url
                  ? `<img src="${data.preview_url}" alt="${data.name}" style="width:100%;height:100%;object-fit:cover;">`
                  : 'Preview coming soon'}
              </div>
            </div>
            <div>
              <h1 class="page-title">${data.name}</h1>
              <p class="page-subtitle" style="margin-bottom:2rem;">${data.description || ''}</p>

              <div style="margin-bottom:2rem;">
                <div class="card-price">$${data.price_usd}</div>
                <div class="card-price-sub">~${data.price_eth} ETH</div>
              </div>

              <h3 style="font-weight:600;margin-bottom:1rem;">What's included</h3>
              <ul style="list-style:none;margin-bottom:2rem;color:var(--text-secondary);">
                <li style="padding:0.35rem 0;">&check; Responsive design</li>
                <li style="padding:0.35rem 0;">&check; Tailwind CSS 3.x</li>
                <li style="padding:0.35rem 0;">&check; 6 pre-built sections</li>
                <li style="padding:0.35rem 0;">&check; Dark theme</li>
                <li style="padding:0.35rem 0;">&check; Clean HTML structure</li>
              </ul>

              <h3 style="font-weight:600;margin-bottom:1rem;">How to buy</h3>
              <ol class="steps-list" style="margin-bottom:2rem;">
                <li>
                  Send exactly <strong>${data.price_eth} ETH</strong> (or equivalent USDC) to the wallet below.
                  <div class="wallet-address" style="margin-top:0.75rem;">
                    <span id="wallet-addr">${WEAVE_CONFIG.WALLET_ADDRESS}</span>
                    <button class="copy-btn" onclick="copyWallet()">Copy</button>
                  </div>
                </li>
                <li>Copy the transaction hash (0x...) from your wallet after sending.</li>
                <li>Fill in the form below with your email, transaction hash, and sending wallet address.</li>
                <li>Wait for verification (usually under 5 minutes). You'll get download access on your dashboard.</li>
              </ol>
            </div>
          </div>

          <div style="max-width:600px;margin-top:3rem;">
            <h2 style="font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;">Verify Your Purchase</h2>
            <p class="text-secondary" style="margin-bottom:1.5rem;">Already sent the crypto? Enter your details below to get access.</p>
            <form id="purchase-form" onsubmit="submitPurchase(event, ${data.id})">
              <div class="form-group">
                <label class="form-label" for="email">Email address</label>
                <input class="form-input" type="email" id="email" required placeholder="you@example.com">
              </div>
              <div class="form-group">
                <label class="form-label" for="tx-hash">Transaction hash</label>
                <input class="form-input font-mono" type="text" id="tx-hash" required placeholder="0x...">
              </div>
              <div class="form-group">
                <label class="form-label" for="sender-wallet">Your sending wallet address</label>
                <input class="form-input font-mono" type="text" id="sender-wallet" required placeholder="0x...">
              </div>
              <div class="form-group">
                <label class="form-label" for="discord">Discord username (optional)</label>
                <input class="form-input" type="text" id="discord" placeholder="username#0000">
              </div>
              <button class="btn btn-primary" type="submit" id="submit-btn">Submit for Verification</button>
            </form>
            <div id="form-status" style="margin-top:1rem;"></div>
          </div>
        `;
      } catch (err) {
        document.getElementById('product-detail').innerHTML = '<p class="text-secondary">Product not found. <a href="index.html" class="text-accent">Browse products.</a></p>';
      }
    }

    function copyWallet() {
      navigator.clipboard.writeText(WEAVE_CONFIG.WALLET_ADDRESS);
      const btn = document.querySelector('.copy-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }

    document.addEventListener('DOMContentLoaded', loadProduct);
  </script>
</body>
</html>
```

---

### Task 6: purchase-form.js — Purchase submission handler

**Files:**
- Create: `js/purchase-form.js`

- [ ] **Step 1: Create purchase-form.js**

```js
async function submitPurchase(event, templateId) {
  event.preventDefault();
  const btn = document.getElementById('submit-btn');
  const status = document.getElementById('form-status');
  const email = document.getElementById('email').value.trim();
  const txHash = document.getElementById('tx-hash').value.trim();
  const senderWallet = document.getElementById('sender-wallet').value.trim();
  const discordUsername = document.getElementById('discord').value.trim();

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      status.innerHTML = '<p style="color:var(--error);">You must be <a href="dashboard.html" style="color:var(--accent);">signed in</a> to submit a purchase.</p>';
      btn.disabled = false;
      btn.textContent = 'Submit for Verification';
      return;
    }

    const { data, error } = await supabaseClient
      .from('purchases')
      .insert({
        user_id: user.id,
        template_id: templateId,
        tx_hash: txHash,
        sender_wallet: senderWallet,
        discord_username: discordUsername || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        status.innerHTML = '<p style="color:var(--error);">This transaction hash has already been used. Each hash can only be verified once.</p>';
      } else {
        status.innerHTML = `<p style="color:var(--error);">Submission failed: ${error.message}</p>`;
      }
      btn.disabled = false;
      btn.textContent = 'Submit for Verification';
      return;
    }

    status.innerHTML = '<p style="color:var(--success);">Payment submitted successfully! Your purchase is pending verification. Check your dashboard for updates. Usually takes under 5 minutes.</p>';
    document.getElementById('purchase-form').reset();
  } catch (err) {
    status.innerHTML = '<p style="color:var(--error);">Something went wrong. Please try again.</p>';
  }

  btn.disabled = false;
  btn.textContent = 'Submit for Verification';
}
```

---

### Task 7: auth.js — Signup, login, logout

**Files:**
- Create: `js/auth.js`

- [ ] **Step 1: Create auth.js**

```js
async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return user;
}

function onAuthStateChanged(callback) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
```

---

### Task 8: dashboard.html and dashboard.js — Auth-gated dashboard with download

**Files:**
- Create: `dashboard.html`
- Create: `js/dashboard.js`

- [ ] **Step 1: Create js/dashboard.js**

```js
async function initDashboard() {
  const user = await getCurrentUser().catch(() => null);
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');

  if (!user) {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    return;
  }

  authSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  document.getElementById('user-email').textContent = user.email;
  await loadPurchases(user.id);
}

async function loadPurchases(userId) {
  const tbody = document.getElementById('purchases-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-secondary);"><div class="skeleton" style="height:40px;margin:0.5rem 0;"></div></td></tr>';

  try {
    const { data, error } = await supabaseClient
      .from('purchases')
      .select('*, templates(name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-secondary);">No purchases yet. <a href="index.html" style="color:var(--accent);">Browse templates.</a></td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => {
      const statusBadge = p.status === 'verified' ? 'badge badge-verified' :
                          p.status === 'rejected' ? 'badge badge-rejected' :
                          'badge badge-pending';
      const statusText = p.status.charAt(0).toUpperCase() + p.status.slice(1);

      let downloadBtn = '';
      if (p.status === 'verified' && p.templates) {
        downloadBtn = `<button class="btn btn-primary btn-sm" onclick="downloadTemplate(${p.template_id})">Download</button>`;
      }

      return `
        <tr>
          <td>${p.templates ? p.templates.name : 'Unknown'}</td>
          <td>${new Date(p.created_at).toLocaleDateString()}</td>
          <td><span class="${statusBadge}">${statusText}</span></td>
          <td>${downloadBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--error);">Failed to load purchases.</td></tr>';
  }
}

async function downloadTemplate(templateId) {
  try {
    const { data, error } = await supabaseClient
      .from('templates')
      .select('storage_path, name')
      .eq('id', templateId)
      .single();

    if (error || !data) throw error;

    const { data: urlData, error: urlError } = await supabaseClient
      .storage
      .from('template-files')
      .createSignedUrl(data.storage_path, 3600);

    if (urlError || !urlData) throw urlError;

    window.open(urlData.signedUrl, '_blank');
  } catch (err) {
    showToast('Failed to generate download link. Please try again.', 'error');
  }
}

function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const isSignUp = document.getElementById('auth-mode').textContent === 'Sign Up';
  const status = document.getElementById('auth-status');

  (isSignUp ? signUp(email, password) : signIn(email, password))
    .then(() => {
      status.textContent = isSignUp ? 'Check your email to confirm signup.' : 'Signed in successfully.';
      status.style.color = 'var(--success)';
      if (!isSignUp) setTimeout(initDashboard, 500);
    })
    .catch(err => {
      status.textContent = err.message;
      status.style.color = 'var(--error)';
    });
}

function toggleAuthMode() {
  const mode = document.getElementById('auth-mode');
  const toggle = document.getElementById('auth-toggle');
  const submitBtn = document.getElementById('auth-submit');
  if (mode.textContent === 'Sign Up') {
    mode.textContent = 'Sign In';
    toggle.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleAuthMode();return false;">Sign up</a>';
    submitBtn.textContent = 'Sign In';
  } else {
    mode.textContent = 'Sign Up';
    toggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode();return false;">Sign in</a>';
    submitBtn.textContent = 'Sign Up';
  }
  document.getElementById('auth-status').textContent = '';
}

async function handleSignOut() {
  await signOut();
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('dashboard-section').style.display = 'none';
}

function showToast(message, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

document.addEventListener('DOMContentLoaded', initDashboard);
```

- [ ] **Step 2: Create dashboard.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Weave</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/style.css">
  <script src="js/config.js"></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo">Weave</a>
      <nav class="nav-links">
        <a href="index.html">Products</a>
        <a href="faq.html">FAQ</a>
        <a href="dashboard.html">Dashboard</a>
      </nav>
    </div>
  </header>

  <section class="page-section">
    <div class="container">
      <h1 class="page-title">Dashboard</h1>

      <!-- Auth section (shown when logged out) -->
      <div id="auth-section" style="max-width:420px;">
        <h2 id="auth-mode" style="font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;">Sign In</h2>
        <form onsubmit="handleAuth(event)">
          <div class="form-group">
            <label class="form-label" for="auth-email">Email</label>
            <input class="form-input" type="email" id="auth-email" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label class="form-label" for="auth-password">Password</label>
            <input class="form-input" type="password" id="auth-password" required minlength="6" placeholder="Min 6 characters">
          </div>
          <button class="btn btn-primary" type="submit" id="auth-submit">Sign In</button>
          <p id="auth-status" style="margin-top:1rem;font-size:0.9rem;"></p>
        </form>
        <p id="auth-toggle" style="margin-top:1.5rem;font-size:0.9rem;color:var(--text-secondary);">
          Don't have an account? <a href="#" onclick="toggleAuthMode();return false;" class="text-accent">Sign up</a>
        </p>
      </div>

      <!-- Dashboard section (shown when logged in) -->
      <div id="dashboard-section" style="display:none;">
        <div class="flex items-center justify-between mb-4">
          <p class="text-secondary">Signed in as <strong id="user-email" style="color:var(--text-primary);"></strong></p>
          <button class="btn btn-outline btn-sm" onclick="handleSignOut()">Sign Out</button>
        </div>

        <h2 style="font-size:1.15rem;font-weight:600;margin-bottom:1rem;">My Purchases</h2>
        <div style="background:var(--bg-card);border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Date</th>
                <th>Status</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody id="purchases-body">
              <tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-secondary);">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>
```

---

### Task 9: faq.html

**Files:**
- Create: `faq.html`

- [ ] **Step 1: Create faq.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FAQ — Weave</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/style.css">
  <script src="js/config.js"></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="logo">Weave</a>
      <nav class="nav-links">
        <a href="index.html">Products</a>
        <a href="faq.html">FAQ</a>
        <a href="dashboard.html">Dashboard</a>
      </nav>
    </div>
  </header>

  <section class="page-section">
    <div class="container" style="max-width:720px;">
      <h1 class="page-title">Frequently Asked Questions</h1>

      <div class="faq-item">
        <div class="faq-question">What is Weave?</div>
        <div class="faq-answer">Weave sells premium Tailwind CSS landing page templates. Pay once with crypto, download the full source, and use it for any project.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">How do I pay with crypto?</div>
        <div class="faq-answer">Send exactly the listed amount in ETH or USDC to the wallet address shown on the product page. After the transaction confirms, submit the transaction hash and your sending wallet address in the verification form.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">How long does verification take?</div>
        <div class="faq-answer">Usually under 5 minutes. The seller manually verifies each transaction on Etherscan. You'll see the status update on your dashboard once verified.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">What if I send the wrong amount?</div>
        <div class="faq-answer">If you send less than the listed price, the transaction will be rejected. If you send more, contact us and we'll work it out. Always double-check the amount before sending.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">Can I get a refund?</div>
        <div class="faq-answer">Digital product sales are final. If there's a genuine issue with the template (broken code, missing files), contact us and we'll fix it.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">Do I need an account?</div>
        <div class="faq-answer">Yes — create a free account on the Dashboard page. This lets us link your purchase to your profile and provide download access.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">What templates are coming next?</div>
        <div class="faq-answer">Portfolio, Startup Pre-Sale, Waitlist/Coming Soon, and Blog templates are planned. Follow Weave for updates.</div>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      &copy; 2026 Weave.
    </div>
  </footer>
</body>
</html>
```

---

### Task 10: First template — SaaS Landing Page

**Files:**
- Create: `templates/saas-landing/index.html`
- Create: `templates/saas-landing/css/style.css`
- Create: `templates/saas-landing/assets/` (empty placeholder)

- [ ] **Step 1: Create templates/saas-landing/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SaaS Landing — Weave Template</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Licensed to: {{LICENSED_TO}} | TX: {{TX_HASH}} */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }

    /* Hero */
    .hero { padding: 6rem 0; text-align: center; }
    .hero h1 { font-size: 3.5rem; font-weight: 800; line-height: 1.15; margin-bottom: 1.5rem; }
    .hero h1 span { color: #f59e0b; }
    .hero p { font-size: 1.15rem; color: #94a3b8; max-width: 600px; margin: 0 auto 2rem; line-height: 1.7; }
    .hero-cta { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; padding: 0.85rem 2rem; border-radius: 8px; font-weight: 600; font-size: 0.95rem; text-decoration: none; transition: all 0.2s; }
    .btn-primary { background: #f59e0b; color: #0f172a; }
    .btn-primary:hover { background: #d97706; }
    .btn-outline { border: 1px solid rgba(255,255,255,0.15); color: #f8fafc; }
    .btn-outline:hover { border-color: #f59e0b; }

    /* Features */
    .features { padding: 5rem 0; border-top: 1px solid rgba(255,255,255,0.06); }
    .features h2 { text-align: center; font-size: 2rem; font-weight: 700; margin-bottom: 3rem; }
    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    .feature-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 2rem; transition: transform 0.2s; }
    .feature-card:hover { transform: translateY(-3px); }
    .feature-icon { width: 48px; height: 48px; background: rgba(245,158,11,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem; }
    .feature-card h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .feature-card p { font-size: 0.9rem; color: #94a3b8; line-height: 1.6; }

    /* Pricing */
    .pricing { padding: 5rem 0; border-top: 1px solid rgba(255,255,255,0.06); }
    .pricing h2 { text-align: center; font-size: 2rem; font-weight: 700; margin-bottom: 3rem; }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .pricing-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 2.5rem 2rem; text-align: center; }
    .pricing-card.featured { border-color: #f59e0b; position: relative; }
    .pricing-card.featured::before { content: 'Popular'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #f59e0b; color: #0f172a; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 1rem; border-radius: 999px; }
    .pricing-card h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .pricing-card .price { font-size: 2.5rem; font-weight: 800; margin: 1rem 0; }
    .pricing-card .price span { font-size: 1rem; font-weight: 400; color: #94a3b8; }
    .pricing-card ul { list-style: none; margin: 1.5rem 0; text-align: left; }
    .pricing-card ul li { padding: 0.5rem 0; font-size: 0.9rem; color: #94a3b8; }
    .pricing-card ul li::before { content: '✓ '; color: #22c55e; }

    /* CTA */
    .cta { padding: 5rem 0; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); }
    .cta h2 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
    .cta p { color: #94a3b8; margin-bottom: 2rem; max-width: 500px; margin-left: auto; margin-right: auto; }

    /* Footer */
    footer { padding: 2rem 0; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; color: #64748b; font-size: 0.85rem; }
    .footer-links { display: flex; gap: 1.5rem; justify-content: center; margin-bottom: 1rem; }
    .footer-links a { color: #94a3b8; text-decoration: none; font-size: 0.85rem; }

    @media (max-width: 768px) {
      .hero h1 { font-size: 2rem; }
      .features-grid, .pricing-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <section class="hero">
    <div class="container">
      <h1>Build Faster.<br><span>Launch Smarter.</span></h1>
      <p>The all-in-one platform for modern teams. Ship products in days, not months, with our powerful suite of tools.</p>
      <div class="hero-cta">
        <a href="#" class="btn btn-primary">Start Free Trial</a>
        <a href="#" class="btn btn-outline">View Demo</a>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="container">
      <h2>Everything you need</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Lightning Fast</h3>
          <p>Optimized infrastructure that scales with your traffic. 99.9% uptime guaranteed.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3>Secure by Default</h3>
          <p>Enterprise-grade encryption and security practices built into every layer.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎨</div>
          <h3>Flexible Design</h3>
          <p>Customizable workflows and integrations that adapt to your team's needs.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Real-time Analytics</h3>
          <p>Actionable insights with live dashboards and customizable reports.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🤝</div>
          <h3>Team Collaboration</h3>
          <p>Work together seamlessly with shared workspaces and version control.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🌐</div>
          <h3>Global Reach</h3>
          <p>CDN-powered delivery with edge caching in 50+ locations worldwide.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="pricing">
    <div class="container">
      <h2>Simple, transparent pricing</h2>
      <div class="pricing-grid">
        <div class="pricing-card">
          <h3>Basic</h3>
          <div class="price">$19<span>/mo</span></div>
          <ul>
            <li>Up to 5 users</li>
            <li>10GB storage</li>
            <li>Basic analytics</li>
            <li>Email support</li>
          </ul>
          <a href="#" class="btn btn-outline" style="width:100%;">Get Started</a>
        </div>
        <div class="pricing-card featured">
          <h3>Pro</h3>
          <div class="price">$49<span>/mo</span></div>
          <ul>
            <li>Up to 25 users</li>
            <li>100GB storage</li>
            <li>Advanced analytics</li>
            <li>Priority support</li>
            <li>API access</li>
          </ul>
          <a href="#" class="btn btn-primary" style="width:100%;">Get Started</a>
        </div>
        <div class="pricing-card">
          <h3>Enterprise</h3>
          <div class="price">$149<span>/mo</span></div>
          <ul>
            <li>Unlimited users</li>
            <li>1TB storage</li>
            <li>Custom analytics</li>
            <li>24/7 phone support</li>
            <li>API access</li>
            <li>Dedicated infra</li>
          </ul>
          <a href="#" class="btn btn-outline" style="width:100%;">Contact Sales</a>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="container">
      <h2>Ready to get started?</h2>
      <p>Join thousands of teams already building with Weave templates.</p>
      <a href="#" class="btn btn-primary">Start Free Trial</a>
    </div>
  </section>

  <footer>
    <div class="footer-links">
      <a href="#">Product</a>
      <a href="#">Features</a>
      <a href="#">Pricing</a>
      <a href="#">Docs</a>
      <a href="#">Contact</a>
    </div>
    &copy; 2026 YourCompany. All rights reserved.
  </footer>
</body>
</html>
```

- [ ] **Step 2: Create templates/saas-landing/css/style.css** (empty — all styles inline in index.html)
- [ ] **Step 3: Create placeholder directory**

```bash
mkdir -p templates/saas-landing/assets
```

---

### Task 11: Populate templates table in Supabase

- [ ] **Step 1: Insert the first template record**

Run this SQL in Supabase SQL Editor:

```sql
INSERT INTO templates (name, slug, description, price_usd, price_eth, storage_path, preview_url)
VALUES (
  'SaaS Landing',
  'saas-landing',
  'Modern SaaS landing page with hero, features grid, pricing table, and CTA section. Fully responsive Tailwind CSS.',
  29.00,
  0.01,
  'saas-landing.zip',
  NULL
);
```

- [ ] **Step 2: Upload the template ZIP to Supabase Storage**
  - Create a ZIP of `templates/saas-landing/` (all files inside — the buyer extracts this ZIP to get their template)
  - Go to Supabase Dashboard → Storage → `template-files` bucket
  - Upload `saas-landing.zip`
  - Verify the file name matches `storage_path` in the templates table

---

### Task 12: Deploy and verify

- [ ] **Step 1: Push to GitHub**
```bash
git init
git add .
git commit -m "feat: initial Weave shop"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/weave.git
git push -u origin main
```

- [ ] **Step 2: Verify deployment**
  - GitHub Actions runs the deploy workflow automatically
  - Go to your repo → Actions tab → confirm workflow succeeds
  - Visit `https://YOUR_USERNAME.github.io/weave/`
  - Test all pages load, auth works, purchase form submits

- [ ] **Step 3: Verify security**
  - Clone the repo fresh and confirm `js/config.js` does NOT exist
  - Confirm `templates/` is NOT in the repo
  - Confirm `` the deployed site loads (anon key is in the deployed bundle, which is by-design for Supabase client-side apps)
  - Test that unauthenticated users cannot access download links

---

### Security Checklist

- [ ] No template files in git repo (.gitignore)
- [ ] Supabase anon key injected via GitHub Actions secret — never committed
- [ ] Supabase service_role key never touches frontend code
- [ ] RLS policies tested: unauthenticated user cannot query purchases table
- [ ] RLS policies tested: user A cannot see user B's purchases
- [ ] Unique constraint on tx_hash tested: duplicate submission is rejected
- [ ] Storage bucket is PRIVATE (not public)
- [ ] Signed URLs expire after 1 hour
- [ ] Config file in .gitignore
