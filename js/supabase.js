// Weave Supabase Client — Direct REST API (no CDN dependency)
// Reads credentials from WEAVE_CONFIG (config.js, gitignored) or falls back to hardcoded defaults.
// Never commit real secrets to git — config.js is .gitignored.
// For deployment, set SUPABASE_URL and SUPABASE_ANON_KEY as GitHub repo secrets.

const _cfg = typeof WEAVE_CONFIG !== 'undefined' ? WEAVE_CONFIG : {};
const SUPABASE_URL = _cfg.SUPABASE_URL || 'https://rxivkqyeseekctagcgln.supabase.co';
const SUPABASE_ANON_KEY = _cfg.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aXZrcXllc2Vla2N0YWdjZ2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzU0MDgsImV4cCI6MjA5NDcxMTQwOH0.JVlcn9ua4Yl2rSoBeqtNXAUhbzuL2VHIBjXiBpZiHwo';
const WALLET_ADDRESS = _cfg.WALLET_ADDRESS || '0xbe9Db9c86B79617231a4861fb54ef278447D43fb';

// Headers for Supabase REST API
const sbHeaders = (token) => {
  const h = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

// ===================== AUTH =====================

function sbGetSession() {
  try {
    const raw = localStorage.getItem('sb-session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function sbSetSession(data) {
  if (data) localStorage.setItem('sb-session', JSON.stringify(data));
  else localStorage.removeItem('sb-session');
}

async function sbSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error || 'Sign up failed');
  if (data.access_token) sbSetSession(data);
  return data;
}

async function sbSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Sign in failed');
  sbSetSession(data);
  return data;
}

async function sbSignOut() {
  const session = sbGetSession();
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: sbHeaders(session.access_token)
    }).catch(() => {});
  }
  sbSetSession(null);
}

async function sbGetUser() {
  const session = sbGetSession();
  if (!session?.access_token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: sbHeaders(session.access_token)
  });
  if (!res.ok) { sbSetSession(null); return null; }
  return await res.json();
}

// ===================== DATABASE =====================

async function sbSelect(table, opts = {}) {
  const session = sbGetSession();
  const params = new URLSearchParams();
  if (opts.select) params.set('select', opts.select);
  if (opts.eq) params.set(opts.eq[0], `eq.${opts.eq[1]}`);
  if (opts.order) params.set('order', `${opts.order}.desc`);
  if (opts.single) params.set('limit', '1');
  const qs = params.toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: sbHeaders(session?.access_token) });
  if (!res.ok) throw new Error(`DB select error: ${res.status}`);
  const data = await res.json();
  return opts.single ? (data?.[0] || null) : (data || []);
}

async function sbInsert(table, body) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...sbHeaders(session.access_token),
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, message: err.message || err.details || 'Insert failed', code: err.code };
  }
  return await res.json();
}

// ===================== STORAGE =====================

async function sbSignedUrl(path, expiresIn = 3600) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/template-files/${path}`, {
    method: 'POST',
    headers: sbHeaders(session.access_token),
    body: JSON.stringify({ expiresIn })
  });
  if (!res.ok) throw new Error('Signed URL failed');
  const data = await res.json();
  return `${SUPABASE_URL}/storage/v1/object/sign/template-files/${path}?token=${data.signedURL || data.token}`;
}

function sbPublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/template-files/${path}`;
}

// ===================== LOGGING =====================

const sbLog = {
  info: (msg, data) => console.log(`[Weave] ℹ️ ${msg}`, data || ''),
  ok: (msg, data) => console.log(`[Weave] ✅ ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[Weave] ⚠️ ${msg}`, data || ''),
  error: (msg, data) => console.error(`[Weave] ❌ ${msg}`, data || ''),
  network: (method, url, status) => console.log(`[Weave] 🌐 ${method} ${url.split('?')[0]} → ${status}`)
};
