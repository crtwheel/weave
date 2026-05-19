// Weave Supabase Client — Direct REST API (no CDN dependency)
// Reads credentials from WEAVE_CONFIG (config.js, gitignored) or falls back to hardcoded defaults.
// Never commit real secrets to git — config.js is .gitignored.
// For deployment, set SUPABASE_URL and SUPABASE_ANON_KEY as GitHub repo secrets.

const _cfg = typeof WEAVE_CONFIG !== 'undefined' ? WEAVE_CONFIG : {};
const SUPABASE_URL = _cfg.SUPABASE_URL || 'https://rxivkqyeseekctagcgln.supabase.co';
const SUPABASE_ANON_KEY = _cfg.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aXZrcXllc2Vla2N0YWdjZ2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzU0MDgsImV4cCI6MjA5NDcxMTQwOH0.JVlcn9ua4Yl2rSoBeqtNXAUhbzuL2VHIBjXiBpZiHwo';
const WALLET_ADDRESS = _cfg.WALLET_ADDRESS || '0xbe9Db9c86B79617231a4861fb54ef278447D43fb';

/**
 * Build headers for Supabase REST API calls.
 * Constructs the standard headers object required by all Supabase REST endpoints.
 * Automatically includes the apikey (anon key) and sets Content-Type to JSON.
 * If a valid session token is provided, it is attached as a Bearer Authorization header
 * for authenticated requests.
 *
 * @param {string} [token] - Optional Bearer token for authenticated requests.
 * @returns {Object} Headers object with apikey, Content-Type, and optional Authorization.
 * @example
 * // Unauthenticated request
 * sbHeaders(); // { apikey: '...', 'Content-Type': 'application/json' }
 * @example
 * // Authenticated request
 * sbHeaders('eyJhbGci...'); // { apikey: '...', 'Content-Type': '...', Authorization: 'Bearer eyJhbGci...' }
 */
const sbHeaders = (token) => {
  const h = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

/**
 * Get the current Supabase session from localStorage.
 * Reads the 'sb-session' key and parses the stored JSON.
 * Returns null if no session exists or if the stored data is corrupted JSON.
 *
 * @returns {Object|null} Session object with access_token, refresh_token, expires_in, or null if not authenticated.
 * @example
 * const session = sbGetSession();
 * // { access_token: 'eyJhbGci...', refresh_token: 'abc...', expires_in: 3600, ... }
 */
function sbGetSession() {
  try {
    const raw = localStorage.getItem('sb-session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Save or clear the Supabase session in localStorage.
 * When data is provided, serializes it to JSON and stores under 'sb-session'.
 * When data is null or undefined, removes the stored session entirely.
 * Used internally after sign-in, sign-up, and sign-out operations.
 *
 * @param {Object|null} data - Session data to store, or null to remove the session.
 * @example
 * sbSetSession({ access_token: 'eyJ...', refresh_token: 'abc...' });
 * @example
 * sbSetSession(null); // clears session
 */
function sbSetSession(data) {
  if (data) localStorage.setItem('sb-session', JSON.stringify(data));
  else localStorage.removeItem('sb-session');
}

/**
 * Sign up a new user with email and password via Supabase Auth.
 * Sends a POST request to the Supabase auth/signup endpoint.
 * On success, automatically saves the session to localStorage if an access_token is returned.
 * This creates a user in the Supabase Auth system but does NOT create a profile record
 * — that must be done separately (see sbAuth.signUp in auth.js).
 *
 * @param {string} email - User's email address.
 * @param {string} password - User's password (min 6 characters recommended by Supabase).
 * @returns {Promise<Object>} The auth response data including user and session.
 * @throws {Error} If sign-up fails due to network error or API rejection.
 * @example
 * try {
 *   const result = await sbSignUp('user@example.com', 'securepass123');
 *   // result = { id: 'abc-123', access_token: 'eyJ...', user: { ... } }
 * } catch (err) {
 *   console.error(err.message);
 * }
 */
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

/**
 * Sign in an existing user with email and password via Supabase Auth.
 * Uses the password grant type to exchange credentials for a session token.
 * On success, saves the session to localStorage automatically.
 *
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 * @returns {Promise<Object>} The auth response data including access_token and user.
 * @throws {Error} If sign-in fails due to invalid credentials or network error.
 * @example
 * try {
 *   const session = await sbSignIn('user@example.com', 'securepass123');
 *   // session = { access_token: 'eyJ...', token_type: 'bearer', user: { ... } }
 * } catch (err) {
 *   Toast.error(err.message);
 * }
 */
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

/**
 * Sign out the current user by invalidating the session server-side and clearing local storage.
 * Sends a POST to the Supabase logout endpoint (fire-and-forget, errors are silently caught).
 * Always clears the local session regardless of the server response.
 *
 * @returns {Promise<void>}
 * @example
 * await sbSignOut();
 * // Session cleared, user is now anonymous
 */
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

/**
 * Get the currently authenticated user's data from Supabase Auth.
 * Fetches the user object from the auth/v1/user endpoint using the stored session token.
 * If the token is expired or invalid, clears the session and returns null.
 *
 * @returns {Promise<Object|null>} User object with id, email, and metadata, or null if not authenticated.
 * @example
 * const user = await sbGetUser();
 * if (user) {
 *   // user = { id: 'abc-123', email: 'user@example.com', ... }
 * }
 */
async function sbGetUser() {
  const session = sbGetSession();
  if (!session?.access_token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: sbHeaders(session.access_token)
  });
  if (!res.ok) { sbSetSession(null); return null; }
  return await res.json();
}

/**
 * Select rows from a Supabase table with optional filtering, ordering, and pagination.
 * Builds a URL query string from the provided options object and sends a GET request
 * to the Supabase REST API. Supports a wide range of filters including eq, neq, gte,
 * lte, ilike, in, or ordering, limit, and offset. Can return either an array of rows
 * or a single object when opts.single is true.
 *
 * @param {string} table - The database table name (e.g. 'templates', 'profiles').
 * @param {Object} [opts] - Query options.
 * @param {string} [opts.select] - Columns to select (e.g. 'id,name,description').
 * @param {Array|Array[]} [opts.eq] - Equality filter(s). Single [col, val] or array of pairs.
 * @param {Array} [opts.neq] - Not-equal filter as [col, val].
 * @param {Array} [opts.gte] - Greater-than-or-equal filter as [col, val].
 * @param {Array} [opts.lte] - Less-than-or-equal filter as [col, val].
 * @param {Array} [opts.ilike] - Case-insensitive like filter as [col, val].
 * @param {Array} [opts.in] - IN filter as [col, valuesArray].
 * @param {string} [opts.or] - Raw OR predicate string.
 * @param {string} [opts.order] - Column to order by.
 * @param {string} [opts.orderDir] - Sort direction ('asc' or 'desc', default 'desc').
 * @param {number} [opts.limit] - Maximum number of rows to return.
 * @param {number} [opts.offset] - Number of rows to skip.
 * @param {boolean} [opts.single] - If true, returns a single object instead of an array.
 * @returns {Promise<Object|Object[]|null>} Row(s) matching the query, or null if single not found.
 * @throws {Error} If the database request fails.
 * @example
 * // Get all templates ordered by creation date
 * const templates = await sbSelect('templates', { order: 'created_at', orderDir: 'desc' });
 * @example
 * // Get a single profile by user ID
 * const profile = await sbSelect('profiles', { eq: ['id', userId], single: true });
 * @example
 * // Get templates with multiple filters
 * const result = await sbSelect('templates', {
 *   eq: [['category_slug', 'saas'], ['popular', true]],
 *   limit: 10,
 *   offset: 0
 * });
 */
async function sbSelect(table, opts = {}) {
  const session = sbGetSession();
  const params = new URLSearchParams();
  if (opts.select) params.set('select', opts.select);
  if (opts.eq) {
    const pairs = Array.isArray(opts.eq[0]) ? opts.eq : [opts.eq];
    pairs.forEach(([col, val]) => params.set(col, `eq.${val}`));
  }
  if (opts.neq) params.set(opts.neq[0], `neq.${opts.neq[1]}`);
  if (opts.gte) params.set(opts.gte[0], `gte.${opts.gte[1]}`);
  if (opts.lte) params.set(opts.lte[0], `lte.${opts.lte[1]}`);
  if (opts.ilike) params.set(opts.ilike[0], `ilike.${opts.ilike[1]}`);
  if (opts.in) params.set(opts.in[0], `in.(${Array.isArray(opts.in[1]) ? opts.in[1].join(',') : opts.in[1]})`);
  if (opts.or) params.set('or', opts.or);
  if (opts.order) params.set('order', `${opts.order}.${opts.orderDir || 'desc'}`);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.single) params.set('limit', '1');
  const qs = params.toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: sbHeaders(session?.access_token) });
  if (!res.ok) throw new Error(`DB select error: ${res.status}`);
  const data = await res.json();
  return opts.single ? (data?.[0] || null) : (data || []);
}

/**
 * Insert a new row into a Supabase table.
 * Sends a POST request to the REST API with the Prefer: return=representation header
 * so the response includes the newly created row. Requires authentication.
 *
 * @param {string} table - The database table name (e.g. 'purchases', 'profiles').
 * @param {Object} body - The row data to insert as a JSON object.
 * @returns {Promise<Object|Object[]>} The inserted row(s) with representation returned.
 * @throws {Object|Error} Throws an object with status/message/code on failure, or Error if not authenticated.
 * @example
 * try {
 *   const newPurchase = await sbInsert('purchases', {
 *     user_id: userId,
 *     template_id: templateId,
 *     status: 'pending'
 *   });
 * } catch (err) {
 *   console.error(err.message);
 * }
 */
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

/**
 * Update a row in a Supabase table by ID.
 * Sends a PATCH request targeting the row where id matches the provided value.
 * Requires authentication. Returns the updated row via Prefer: return=representation.
 *
 * @param {string} table - The database table name (e.g. 'profiles', 'templates').
 * @param {string|number} id - The primary key value of the row to update.
 * @param {Object} body - The column values to update as a JSON object.
 * @returns {Promise<Object|Object[]>} The updated row(s) with representation returned.
 * @throws {Object|Error} Throws an object with status/message/code on failure, or Error if not authenticated.
 * @example
 * await sbUpdate('profiles', userId, { role: 'admin', updated_at: new Date().toISOString() });
 */
async function sbUpdate(table, id, body) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(session.access_token), 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, message: err.message || err.details || 'Update failed', code: err.code };
  }
  return await res.json();
}

/**
 * Delete a row from a Supabase table by ID.
 * Sends a DELETE request targeting the row where id matches the provided value.
 * Requires authentication. Returns true on success.
 *
 * @param {string} table - The database table name (e.g. 'favorites', 'templates').
 * @param {string|number} id - The primary key value of the row to delete.
 * @returns {Promise<boolean>} True if the deletion was successful.
 * @throws {Error} If not authenticated or the delete request fails.
 * @example
 * await sbDelete('favorites', favoriteId);
 */
async function sbDelete(table, id) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: sbHeaders(session.access_token)
  });
  if (!res.ok) throw new Error(`Delete error: ${res.status}`);
  return true;
}

/**
 * Generate a signed URL for a private storage object.
 * Creates a time-limited signed URL for secure file access from the template-files bucket.
 * The URL expires after the specified duration (default 1 hour).
 *
 * @param {string} path - The file path within the template-files bucket (e.g. 'templates/my-template.zip').
 * @param {number} [expiresIn=3600] - Expiration time in seconds (default 1 hour, max 7 days).
 * @returns {Promise<string>} The signed URL string.
 * @throws {Error} If not authenticated or the request fails.
 * @example
 * const downloadUrl = await sbSignedUrl('templates/saas-landing.zip', 3600);
 * // downloadUrl = 'https://project.supabase.co/storage/v1/object/sign/...'
 */
async function sbSignedUrl(path, expiresIn = 3600) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/template-files/${path}`, {
    method: 'POST',
    headers: sbHeaders(session.access_token),
    body: JSON.stringify({ expiresIn: String(expiresIn) })
  });
  if (!res.ok) throw new Error('Signed URL failed');
  const data = await res.json();
  return data.signedURL;
}

/**
 * Build a public URL for a storage object (no auth required).
 * Constructs the full public URL for files in the template-files bucket.
 * Unlike signed URLs, public URLs do not expire and require no authentication.
 *
 * @param {string} path - The file path within the template-files bucket.
 * @returns {string} The full public URL string.
 * @example
 * const url = sbPublicUrl('thumbs/saas-landing.png');
 * // url = 'https://project.supabase.co/storage/v1/object/public/template-files/thumbs/saas-landing.png'
 */
function sbPublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/template-files/${path}`;
}

// ===================== UTILITY (deprecated — kept for backwards compat) =====================

/**
 * Update a row in a Supabase table by ID.
 * @deprecated Use sbUpdate(table, id, body) — duplicate function kept for backwards compatibility.
 * This function is identical to the sbUpdate above. It exists because earlier versions of
 * this file exported both sbUpdate and sbDelete at the bottom and some pages may still
 * reference them from this location. New code should use the primary declaration above.
 *
 * @param {string} table - The database table name.
 * @param {string|number} id - The primary key value of the row to update.
 * @param {Object} body - The column values to update.
 * @returns {Promise<Object|Object[]>} The updated row(s) with representation returned.
 * @throws {Object|Error} Throws an object with status/message/code on failure, or Error if not authenticated.
 */
async function sbUpdate(table, id, body) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      ...sbHeaders(session.access_token),
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, message: err.message || err.details || 'Update failed', code: err.code };
  }
  return await res.json();
}

/**
 * Delete a row from a Supabase table by ID.
 * @deprecated Use sbDelete(table, id) — duplicate function kept for backwards compatibility.
 * This function is identical to the sbDelete above. It exists because earlier versions of
 * this file had these utility functions at the bottom and some pages may still reference
 * them from this declaration. New code should use the primary declaration above.
 *
 * @param {string} table - The database table name.
 * @param {string|number} id - The primary key value of the row to delete.
 * @returns {Promise<void>}
 * @throws {Error} If not authenticated or the delete request fails.
 */
async function sbDelete(table, id) {
  const session = sbGetSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: sbHeaders(session.access_token)
  });
  if (!res.ok) throw new Error('Delete failed');
}

/**
 * Logging utility for structured console messages with emoji prefixes.
 * Provides convenience methods for info, success, warning, error, and network logging.
 * All logs are prefixed with [Weave] to distinguish them from other console output.
 * @namespace
 */
const sbLog = {
  /**
   * Log an informational message.
   * Prefix: ℹ️ — used for general status updates and cache operations.
   * @param {string} msg - The log message.
   * @param {*} [data] - Optional data to append after the message.
   * @example
   * sbLog.info('Cache miss', 'templates_popular');
   */
  info: (msg, data) => console.log(`[Weave] ℹ️ ${msg}`, data || ''),
  /**
   * Log a success message.
   * Prefix: ✅ — used for completed operations like sign-in, data load, etc.
   * @param {string} msg - The log message.
   * @param {*} [data] - Optional data to append after the message.
   * @example
   * sbLog.ok('Auth: sign in success', 'user@example.com');
   */
  ok: (msg, data) => console.log(`[Weave] ✅ ${msg}`, data || ''),
  /**
   * Log a warning message.
   * Prefix: ⚠️ — used for non-critical issues like validation failures, missing data.
   * @param {string} msg - The log message.
   * @param {*} [data] - Optional data to append after the message.
   * @example
   * sbLog.warn('Validation: email is required');
   */
  warn: (msg, data) => console.warn(`[Weave] ⚠️ ${msg}`, data || ''),
  /**
   * Log an error message.
   * Prefix: ❌ — used for caught exceptions and failed API calls.
   * @param {string} msg - The log message.
   * @param {*} [data] - Optional error object or data to append.
   * @example
   * sbLog.error('Templates: list failed', err);
   */
  error: (msg, data) => console.error(`[Weave] ❌ ${msg}`, data || ''),
  /**
   * Log a network request summary.
   * Prefix: 🌐 — used to log HTTP method, endpoint, and response status.
   * The URL is truncated to remove query string parameters for readability.
   * @param {string} method - HTTP method (GET, POST, PATCH, DELETE).
   * @param {string} url - The request URL (query string stripped in output).
   * @param {number} status - HTTP response status code.
   * @example
   * sbLog.network('GET', `${SUPABASE_URL}/rest/v1/templates?select=id,name`, 200);
   */
  network: (method, url, status) => console.log(`[Weave] 🌐 ${method} ${url.split('?')[0]} → ${status}`)
};

// ===================== SECRET ADMIN CLAIM — triple-click taskbar green dot =====================

(function() {
  let clickCount = 0;
  let clickTimer = null;

  function createAdminModal() {
    const overlay = document.createElement('div');
    overlay.id = 'secret-admin-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:2.5rem;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;">
        <button id="secret-admin-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-tertiary);line-height:1;">&times;</button>
        <div style="text-align:center;margin-bottom:1.5rem;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">&#x1F510;</div>
          <h2 style="font-family:var(--font-display);font-size:1.15rem;font-weight:700;margin-bottom:0.35rem;">Admin Verification</h2>
          <p style="color:var(--text-secondary);font-size:0.82rem;">Enter owner credentials to unlock full system access.</p>
        </div>
        <form id="secret-admin-form">
          <div class="form-group">
            <label class="form-label" for="secret-admin-key">Owner Key</label>
            <input class="form-input" id="secret-admin-key" type="password" placeholder="Enter owner key" style="font-family:var(--font-display);" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="secret-admin-pass">Verification Code</label>
            <input class="form-input" id="secret-admin-pass" type="password" placeholder="Enter verification code" style="font-family:var(--font-display);" autocomplete="off">
          </div>
          <button class="btn btn-accent" type="submit" id="secret-admin-btn" style="width:100%;">Unlock</button>
          <div id="secret-admin-status" style="margin-top:1rem;"></div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('secret-admin-close').onclick = () => { overlay.style.display = 'none'; };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
    document.getElementById('secret-admin-form').onsubmit = async (e) => {
      e.preventDefault();
      const key = document.getElementById('secret-admin-key').value.trim();
      const pass = document.getElementById('secret-admin-pass').value.trim();
      const status = document.getElementById('secret-admin-status');
      const btn = document.getElementById('secret-admin-btn');
      if (key !== 'ownerkey' || pass !== 'ifyoumanagetogetthisthenyouripisloggedanddonttrytoregistratewiththisorwewillbanyoufromallournetworksandetc') {
        status.innerHTML = '<div style="padding:0.75rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.12);border-radius:8px;font-size:0.82rem;color:#b91c1c;text-align:center;">Invalid credentials.</div>';
        return;
      }
      btn.disabled = true; btn.textContent = 'Unlocking...';
      try {
        const session = sbGetSession();
        if (!session) throw new Error('Not authenticated');
        const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: sbHeaders(session.access_token) });
        const user = await userRes.json();
        if (!user?.id) throw new Error('Could not identify user');
        const res = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + user.id, {
          method: 'PATCH',
          headers: { ...sbHeaders(session.access_token), 'Prefer': 'return=representation' },
          body: JSON.stringify({ role: 'admin' })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.message || errData.details || '';
          if (msg.includes('column') || res.status === 400) {
            throw new Error('Schema needs update. Run the SQL: ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT \'user\'');
          }
          throw new Error(msg || 'Update failed (' + res.status + ')');
        }
        status.innerHTML = '<div style="padding:0.75rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.12);border-radius:8px;font-size:0.82rem;color:#15803d;text-align:center;">&#x2713; Admin access granted! Reloading...</div>';
        sbLog.ok('Secret admin: access granted', user.email);
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        sbLog.error('Secret admin: claim failed', err);
        status.innerHTML = '<div style="padding:0.75rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.12);border-radius:8px;font-size:0.82rem;color:#b91c1c;text-align:center;">' + err.message + '</div>';
      }
      btn.disabled = false; btn.textContent = 'Unlock';
    };
    return overlay;
  }

  document.addEventListener('DOMContentLoaded', function() {
    var dot = document.querySelector('.taskbar-dot');
    if (!dot) return;
    dot.style.cursor = 'pointer';
    dot.title = ' ';
    dot.addEventListener('click', function() {
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(function() { clickCount = 0; }, 600);
      }
      if (clickCount >= 3) {
        clearTimeout(clickTimer);
        clickCount = 0;
        var existing = document.getElementById('secret-admin-overlay');
        if (existing) existing.remove();
        var modal = createAdminModal();
        modal.style.display = 'flex';
      }
    });
  });
})();
