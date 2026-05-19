/**
 * In-memory cache store with TTL expiration.
 * @type {Map<string, {value: *, expires: number}>}
 */
const _cacheStore = new Map();

/**
 * Simple in-memory caching service with TTL support.
 * @namespace
 */
const sbCache = {
  /**
   * Retrieve a cached value by key.
   * @param {string} key - The cache key to look up.
   * @returns {*|null} The cached value, or null if missing or expired.
   */
  get: (key) => {
    const entry = _cacheStore.get(key);
    if (!entry) {
      sbLog.info(`Cache miss: ${key}`);
      return null;
    }
    if (Date.now() > entry.expires) {
      _cacheStore.delete(key);
      sbLog.info(`Cache expired: ${key}`);
      return null;
    }
    sbLog.info(`Cache hit: ${key}`);
    return entry.value;
  },

  /**
   * Store a value in the cache with a TTL.
   * @param {string} key - The cache key.
   * @param {*} value - The value to cache.
   * @param {number} [ttlMs=60000] - Time-to-live in milliseconds (default 60s).
   */
  set: (key, value, ttlMs = 60000) => {
    _cacheStore.set(key, { value, expires: Date.now() + ttlMs });
    sbLog.info(`Cache set: ${key} (TTL: ${ttlMs}ms)`);
  },

  /**
   * Clear a specific cache entry or all entries.
   * @param {string} [key] - Key to clear. If omitted, clears entire cache.
   */
  clear: (key) => {
    if (key !== undefined && key !== null) {
      _cacheStore.delete(key);
      sbLog.info(`Cache cleared: ${key}`);
    } else {
      _cacheStore.clear();
      sbLog.info('Cache cleared: all');
    }
  }
};
