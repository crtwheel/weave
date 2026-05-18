# Weave — Premium Tailwind CSS Template Shop

## Overview
Weave is a digital product shop selling premium Tailwind CSS landing page templates. Built by a vibe coder, for vibe coders and startup founders who want a polished landing page fast. Customers buy templates via crypto (ETH/USDC), verify through a streamlined dashboard flow, and access their files via a private dashboard and Discord.

No monthly costs. No bank account needed. No payment processor taking a cut. Just crypto straight to your wallet, and a clean automated workflow on top.

## Business Model
- **Product:** Single-page Tailwind CSS landing page templates
- **Price:** $29 per template (~0.01 ETH or equivalent USDC)
- **First product:** SaaS Landing Page template
- **Cost to run:** $0/month
- **Revenue target:** $0 → $10K (roughly 345 template sales or a mix of higher-tier bundles)

## Product Line (v1)
1. **SaaS Landing** — hero section with animated headline, 3-column features grid, 3-tier pricing table (Basic/Pro/Enterprise), closing CTA, footer with social links
2. **Future templates** (decided post-v1): Portfolio, Startup Pre-Sale, Waitlist/Coming Soon, Blog — each sold individually or as a bundle

Each template ships as a clean, unminified ZIP containing: `index.html`, compiled `style.css`, and a placeholder `assets/` folder for custom images.

## Tech Stack

| Layer             | Choice              | Cost | Rationale                                                |
|-------------------|---------------------|------|----------------------------------------------------------|
| Shop frontend     | HTML + Tailwind CSS | $0   | Static, fast, deployable anywhere                        |
| Hosting           | GitHub Pages        | $0   | Free, custom domain, automatic deploy from repo          |
| Authentication    | Supabase Auth       | $0   | Email/password signups. No phone needed. Free tier.      |
| Database          | Supabase Postgres   | $0   | User profiles, purchase records, template metadata       |
| File storage      | Supabase Storage    | $0   | Private bucket for template ZIPs. 1GB free.              |
| Payment           | Crypto (ETH/USDC)   | $0   | Buyer sends directly to your wallet. No processor fees.  |
| Delivery          | Dashboard + Discord | $0   | Auto-granted download links. Private Discord channels.   |
| Seller dashboard  | Supabase Studio UI  | $0   | Built-in table editor for verifying purchases.           |
| Discord bot (v1+) | discord.js          | $0   | Auto-role on purchase verification (optional, post-launch)|

## Architecture

### Shop Frontend (GitHub Pages)
The site is served from the repo root via GitHub Pages. Four pages, all static HTML with Tailwind:

**index.html** — Product gallery
- Header with Weave logo, navigation (Products, FAQ, Dashboard link)
- Grid of template cards. Each card has: preview screenshot, template name, price ($29 / 0.01 ETH), and a "View & Buy" button
- Simple, clean, one row of products per template. No clutter.

**product.html** — Single product page (reusable with query params or separate file per template)
- Large preview image / embedded mockup
- Feature list (what's included: 6 sections, Tailwind 3.x, responsive, dark/light mode)
- Price in both USD ($29) and ETH (~0.01)
- The Weave wallet address displayed prominently (copyable)
- Step-by-step buy instructions: (1) Send exactly 0.01 ETH to this address, (2) Copy your transaction hash, (3) Fill in the verification form below
- Verification form: Email (required), Transaction Hash (required), Your Sending Wallet Address (required), Discord Username (optional)
- After submission: "Payment pending verification. You'll get an email and Discord role once confirmed. Usually takes under 5 minutes."

**dashboard.html** — User dashboard (auth-gated via Supabase)
- Unauthenticated users see a login/signup form
- Authenticated users see: their email, a table of purchases (template name, date, status: Pending/Verified/Rejected)
- Verified purchases have a "Download" button that generates a Supabase signed URL (expires in 1 hour)
- Clean, minimal table design. No extra noise.

**faq.html** — FAQ page
- What is Weave?, How do I pay with crypto?, How long does verification take?, What if I send the wrong amount?, Can I get a refund?, What templates are coming next?
- Clear, short answers. No legalese.

### Supabase Backend
**Auth:**
- Email/password signup. No phone verification required.
- On signup, a new row is created in the `users` table via a database trigger.

**Tables:**

```sql
-- Profiles (auto-created on signup via trigger)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  discord_username TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates (product catalog)
CREATE TABLE templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_usd NUMERIC(6,2) NOT NULL DEFAULT 29.00,
  price_eth NUMERIC(10,8) NOT NULL DEFAULT 0.01,
  storage_path TEXT NOT NULL,  -- path in Supabase Storage
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases (buyer records, one per sale)
CREATE TABLE purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  template_id BIGINT REFERENCES templates(id) NOT NULL,
  tx_hash TEXT NOT NULL,
  sender_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'  CHECK (status IN ('pending', 'verified', 'rejected', 'refunded')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_purchases_tx_hash ON purchases(tx_hash);
```

**Row-Level Security (RLS) Policies:**

```sql
-- profiles: users can read/update their own profile only
CREATE POLICY "users_read_own_profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- purchases: users see only their own purchases
CREATE POLICY "users_read_own_purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

-- purchases: users can insert their own purchase submissions
CREATE POLICY "users_insert_own_purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- templates: anyone can read (this is the product catalog)
CREATE POLICY "anyone_read_templates"
  ON templates FOR SELECT
  USING (true);
```

**Storage (Supabase Storage):**
- Bucket name: `template-files`
- Bucket type: **Private** (not public)
- RLS policy on storage.objects:

```sql
-- Only allow download if user has a verified purchase for this template
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

This means: even if someone finds the file path, they cannot download without an authenticated session AND a verified purchase for that specific template.

### Payment Flow (Full Detail)

**Step 1 — Buyer on product page:**
Buyer sees the template preview, price, and your wallet address: `0xbe9Db9c86B79617231a4861fb54ef278447D43fb`. Instructions say: "Send exactly 0.01 ETH to this address using any wallet (MetaMask, Coinbase Wallet, etc.)."

**Step 2 — Buyer sends crypto:**
Buyer opens their wallet, sends 0.01 ETH (or equivalent USDC) to the address above. They receive a transaction hash (0x...) after the transaction is broadcast.

**Step 3 — Buyer submits verification form:**
Buyer fills in:
- Email address (must match their Weave account email)
- Transaction hash (the 0x... string)
- Sending wallet address (the wallet they sent FROM — this is the critical anti-spoof field)
- Discord username (optional, for role assignment)

This creates a new row in `purchases` with `status: 'pending'`.

**Step 4 — Seller verification (you):**
You visit Supabase Studio → Table Editor → `purchases` table. Filter by `status = 'pending'`. For each pending purchase, you:

1. Click the tx_hash link (it opens Etherscan in a new tab)
2. Verify all four checks on Etherscan:
   - ✅ Transaction is confirmed (not pending/failed)
   - ✅ Recipient address matches your wallet (`0xbe9Db9c86B79617231a4861fb54ef278447D43fb`)
   - ✅ Amount is correct (≥ 0.01 ETH or equivalent USDC)
   - ✅ Sender address matches what the buyer submitted in the form
3. If all four pass → change `status` to `'verified'` and set `verified_at = NOW()`
4. If any check fails → change `status` to `'rejected'`

**Step 5 — Delivery (automatic):**
When status changes to `'verified'`:
- Supabase trigger OR the seller manually triggers: user sees the "Download" button on their dashboard
- The download generates a **signed URL** from Supabase Storage (expires in 1 hour, tied to their session)
- One-time download link. If they need it again, they can regenerate from the dashboard.
- Discord role granting is manual for v1 (seller adds role in Discord server)

**Step 6 — Tracking used TX hashes:**
The `tx_hash` column has a UNIQUE index. If someone tries to submit the same transaction hash twice, the INSERT fails. This prevents replay attacks where one sale generates infinite copies.

### Security Architecture (Comprehensive)

**Threat Model:**
Weave sells digital goods worth $29. The security bar is "enough to make fraud not worth the effort" — not bank-grade. The biggest risk is someone getting a template without paying, or paying once and distributing infinitely.

**Attack #1: Fake transaction hash**
- **How it works:** Attacker submits any random string as a transaction hash
- **Defense:** Seller checks the hash on Etherscan as step 1 of verification. A fake hash simply won't exist on-chain. Rejected.

**Attack #2: Replay used transaction hash**
- **How it works:** Attacker takes a real, already-verified transaction hash and submits it
- **Defense:** The `tx_hash` column has a unique index in PostgreSQL. Any duplicate hash INSERT fails with a constraint violation. One hash = one verification = one download.

**Attack #3: Spoof another buyer's transaction**
- **How it works:** Attacker sees a real transaction on Etherscan (public data) and submits that hash claiming it's theirs
- **Defense:** The form requires the SENDING wallet address. Seller checks all four points on Etherscan. The sender address on Etherscan must match what the buyer submitted. An attacker who did not send the transaction cannot provide the correct sending wallet address that matches the on-chain data.

**Attack #4: Direct file access via storage path guessing**
- **How it works:** Attacker guesses the Supabase Storage file path and tries to download directly
- **Defense:** The storage bucket is PRIVATE (not public). RLS policy requires (a) an authenticated Supabase session AND (b) a verified purchase for that exact template. No session, no download.

**Attack #5: Templates in public git repo**
- **How it works:** Attacker clones the GitHub Pages repo and finds template ZIP files
- **Defense:** Template files are NOT in the git repo. They live exclusively in Supabase Storage's private bucket. The repo only contains the shop frontend code. This is enforced in `.gitignore` and the directory structure.

**Attack #6: Brute-force signed URLs**
- **How it works:** Attacker tries to guess Supabase signed URLs
- **Defense:** Signed URLs are (a) only generated server-side for authenticated, verified users, (b) randomly generated with high entropy, and (c) expire in 1 hour. The window is too small and the entropy too high for brute-forcing to be practical.

**Attack #7: Stripping license key and redistributing**
- **How it works:** Legit buyer removes the HTML comment license key and shares the ZIP
- **Defense:** This is accepted as a cost of doing business with digital goods. No DRM can prevent this for static HTML files. Mitigation strategies:
  - License traceability — if a leak happens, the embedded email+tx identifies who leaked
  - Exclusive updates — verified purchasers get free updates and new templates at discount. Shared copies don't.
  - Discord community value — buyers stick around for the community, not just files

### Seller Workflow (Your Side — Streamlined)

This is what you do daily:

1. Open **Supabase Studio** → Table Editor → `purchases` table
2. Filter: `status = 'pending'`
3. For each row, click the tx_hash — it's a hyperlink to Etherscan
4. Check the four points (takes ~30 seconds per sale on Etherscan)
5. If good: click the status cell, change to `'verified'`, hit enter
6. If bad: change to `'rejected'`
7. (Optional) Open Discord and grant the buyer's role manually

That's it. The rest is automatic:
- Buyer gets dashboard access to download link
- Buyer receives Supabase auth email confirmation
- Duplicate tx hashes are rejected at the database level

If you want to automate the Discord role grant later (v1.1), add a Supabase Edge Function that watches the `purchases` table for new `verified` rows and calls the Discord bot API to assign the role.

### Frontend Design Principles

**Visual Identity:**
- Clean, spacious layout. Lots of whitespace.
- Color palette: Deep slate/navy background (`#0f172a`), white text, a single accent color (warm amber/gold `#f59e0b` for CTAs and highlights)
- Monospace font for crypto addresses (JetBrains Mono or similar)
- Smooth micro-interactions: cards lift on hover, buttons have subtle transitions, loading states are skeleton-based

**Dashboard Design:**
- Left sidebar (on desktop) or top nav (on mobile): My Purchases, Browse Templates, Account Settings, Sign Out
- Main area: a simple table with columns: Template, Date, Status, Download
- Status badges: Pending (yellow), Verified (green), Rejected (red)
- No junk — no analytics, no recommendations, no popups
- Mobile responsive: table collapses to card view on small screens

**Typography:**
- Heading: Inter or general sans-serif
- Body: system font stack for performance
- Wallet addresses: monospace, with a one-click copy button

### Directory Structure (Updated)

```
weave/
├── index.html              # Product gallery
├── product.html             # Single product page
├── dashboard.html           # User dashboard (auth-gated)
├── faq.html                 # FAQ page
├── css/
│   └── style.css            # Tailwind compiled output
├── js/
│   ├── supabase-client.js   # Supabase JS client init & helpers
│   ├── auth.js              # Login/signup/logout logic
│   ├── dashboard.js          # Dashboard data fetching & download
│   └── purchase-form.js      # Purchase submission form handler
├── assets/
│   └── previews/            # Template preview screenshots (public)
├── supabase/
│   ├── schema.sql           # Full database schema (tables, indexes, RLS)
│   └── storage-rls.sql      # Storage bucket configuration
└── .gitignore               # Ignore templates/ files if any local copies
```

Note: Template ZIP files are uploaded to Supabase Storage via the Supabase dashboard (drag and drop). The shop frontend never contains template files.

### Success Criteria

- [ ] GitHub Pages site is live at `https://{your-username}.github.io/weave/` or custom domain
- [ ] All four pages render correctly and are fully responsive
- [ ] Email signup works through Supabase Auth (tested with Gmail)
- [ ] User can submit a purchase form with tx_hash and sender_wallet
- [ ] Data appears correctly in Supabase `purchases` table with `status: 'pending'`
- [ ] Seller can change status to `verified` in Supabase Studio
- [ ] Verified user sees "Download" button on dashboard
- [ ] Download link works and delivers correct template ZIP
- [ ] Duplicate tx_hash submission fails (unique constraint test)
- [ ] Template files CANNOT be downloaded without auth + verified purchase
- [ ] Unauthenticated user is redirected to login on dashboard
- [ ] FAQ page answers common questions

### Future Enhancements (Post-v1)

- **Discord bot** — auto-assign role when purchase is verified
- **Email notifications** — send email when purchase is verified (requires SMTP setup or Supabase Edge Function + SendGrid/Resend)
- **Bundle pricing** — buy 3 templates for $69
- **Custom domain** — point `weave.store` or similar to GitHub Pages
- **Automated verification** — Edge Function that checks Etherscan API and auto-verifies transactions (removes manual step)
- **License keys** — simple server-side key generation per download
