/**
 * Template listing, search, favoriting, and rating service.
 * @namespace
 */
const sbTemplates = {
  /**
   * List templates with optional filters, ordering, and caching.
   * @param {Object} [opts] - Additional query options passed to sbSelect.
   * @param {string} [opts.order='created_at'] - Column to sort by.
   * @param {string} [opts.orderDir='desc'] - Sort direction.
   * @returns {Promise<Object[]>} Array of template objects.
   * @throws {Error} If the database query fails.
   */
  list: async (opts = {}) => {
    const cacheKey = `templates_list_${JSON.stringify(opts)}`;
    const cached = sbCache.get(cacheKey);
    if (cached) return cached;
    try {
      const data = await sbSelect('templates', { order: 'created_at', orderDir: 'desc', ...opts });
      sbCache.set(cacheKey, data, 30000);
      return data;
    } catch (err) {
      sbLog.error('Templates: list failed', err);
      throw err;
    }
  },

  /**
   * Get a single template by its slug.
   * @param {string} slug - The URL slug of the template.
   * @returns {Promise<Object|null>} The template object, or null if not found.
   * @throws {Error} If the database query fails.
   */
  get: async (slug) => {
    try {
      const data = await sbSelect('templates', { eq: ['slug', slug], single: true });
      if (!data) sbLog.warn('Templates: not found', slug);
      return data;
    } catch (err) {
      sbLog.error('Templates: get failed', slug);
      throw err;
    }
  },

  /**
   * Search templates by name, description, or tags using ILIKE.
   * @param {string} query - The search query string.
   * @returns {Promise<Object[]>} Array of matching template objects.
   * @throws {Error} If the search query fails.
   */
  search: async (query) => {
    if (!query || typeof query !== 'string') return [];
    const cacheKey = `templates_search_${query.toLowerCase()}`;
    const cached = sbCache.get(cacheKey);
    if (cached) return cached;
    try {
      const q = query.trim();
      const data = await sbSelect('templates', {
        or: `(name.ilike.*${q}*,description.ilike.*${q}*,tags.ilike.*${q}*)`
      });
      sbCache.set(cacheKey, data, 30000);
      sbLog.info('Templates: search', { query, results: data.length });
      return data;
    } catch (err) {
      sbLog.error('Templates: search failed', err);
      throw err;
    }
  },

  /**
   * Get templates filtered by category slug.
   * @param {string} slug - The category slug to filter by.
   * @returns {Promise<Object[]>} Array of template objects in the category.
   * @throws {Error} If the database query fails.
   */
  byCategory: async (slug) => {
    const cacheKey = `templates_cat_${slug}`;
    const cached = sbCache.get(cacheKey);
    if (cached) return cached;
    try {
      const data = await sbSelect('templates', { eq: ['category_slug', slug] });
      sbCache.set(cacheKey, data, 30000);
      return data;
    } catch (err) {
      sbLog.error('Templates: byCategory failed', slug);
      throw err;
    }
  },

  /**
   * Get trending templates sorted by download count.
   * @returns {Promise<Object[]>} Array of up to 6 trending templates.
   * @throws {Error} If the database query fails.
   */
  trending: async () => {
    const cached = sbCache.get('templates_trending');
    if (cached) return cached;
    try {
      const data = await sbSelect('templates', { order: 'downloads', limit: 6 });
      sbCache.set('templates_trending', data, 60000);
      return data;
    } catch (err) {
      sbLog.error('Templates: trending failed', err);
      throw err;
    }
  },

  /**
   * Get popular (featured) templates.
   * @returns {Promise<Object[]>} Array of up to 6 featured templates.
   * @throws {Error} If the database query fails.
   */
  popular: async () => {
    const cached = sbCache.get('templates_popular');
    if (cached) return cached;
    try {
      const data = await sbSelect('templates', { eq: ['popular', true], limit: 6 });
      if (data && data.length > 0) {
        sbCache.set('templates_popular', data, 60000);
        return data;
      }
      sbLog.info('Templates: no popular templates, showing latest');
    } catch (err) {
      sbLog.warn('Templates: popular column missing, falling back to list', err);
    }
    try {
      const data = await sbSelect('templates', { limit: 12, order: 'created_at' });
      sbCache.set('templates_popular', data, 60000);
      return data;
    } catch (fallbackErr) {
      sbLog.error('Templates: fallback list failed', fallbackErr);
      throw fallbackErr;
    }
  },

  /**
   * Get templates the current user has favorited.
   * @returns {Promise<Object[]>} Array of favorited template objects.
   */
  getFavorites: async () => {
    try {
      const user = await sbGetUser();
      if (!user) return [];
      const favs = await sbSelect('favorites', { eq: ['user_id', user.id] }).catch(() => []);
      if (!favs || !favs.length) return [];
      const ids = favs.map(f => f.template_id);
      return await sbSelect('templates', { in: ['id', ids] });
    } catch (err) {
      sbLog.warn('Templates: get favorites failed (table may not exist yet)', err);
      return [];
    }
  },

  /**
   * Toggle a template as favorited/unfavorited for the current user.
   * @param {string|number} templateId - The template's ID.
   * @returns {Promise<boolean>} True if now favorited, false if unfavorited.
   * @throws {Error} If not authenticated or the database operation fails.
   */
  toggleFavorite: async (templateId) => {
    try {
      const user = await sbGetUser();
      if (!user) throw new Error('Not authenticated');

      const fav = await sbSelect('favorites', {
        eq: [['user_id', user.id], ['template_id', templateId]],
        single: true
      });

      if (fav) {
        await sbDelete('favorites', fav.id);
        sbLog.ok('Templates: unfavorited', templateId);
        return false;
      } else {
        await sbInsert('favorites', { user_id: user.id, template_id: templateId });
        sbLog.ok('Templates: favorited', templateId);
        return true;
      }
    } catch (err) {
      sbLog.error('Templates: toggle favorite failed', err);
      throw err;
    }
  },

  /**
   * Check if the current user has favorited a specific template.
   * @param {string|number} templateId - The template's ID.
   * @returns {Promise<boolean>} True if the template is favorited by the user.
   */
  isFavorite: async (templateId) => {
    try {
      const user = await sbGetUser();
      if (!user) return false;
      const fav = await sbSelect('favorites', {
        eq: [['user_id', user.id], ['template_id', templateId]],
        single: true
      });
      return !!fav;
    } catch (err) {
      sbLog.error('Templates: isFavorite check failed', err);
      return false;
    }
  },

  /**
   * Get aggregated rating for a template.
   * @param {string|number} templateId - The template's ID.
   * @returns {Promise<{avg: number, count: number}>} Average score (0-5) and rating count.
   */
  getRating: async (templateId) => {
    try {
      const ratings = await sbSelect('ratings', { eq: ['template_id', templateId] });
      if (!ratings || ratings.length === 0) return { avg: 0, count: 0 };
      const sum = ratings.reduce((s, r) => s + r.score, 0);
      return { avg: +(sum / ratings.length).toFixed(1), count: ratings.length };
    } catch (err) {
      sbLog.error('Templates: get rating failed', err);
      return { avg: 0, count: 0 };
    }
  },

  /**
   * Rate a template (upsert — creates or updates the user's rating).
   * @param {string|number} templateId - The template's ID.
   * @param {number} score - Rating score (typically 1-5).
   * @returns {Promise<boolean>} True if the rating was saved.
   * @throws {Error} If not authenticated or the database operation fails.
   */
  rate: async (templateId, score) => {
    try {
      const user = await sbGetUser();
      if (!user) throw new Error('Not authenticated');

      const existing = await sbSelect('ratings', {
        eq: [['user_id', user.id], ['template_id', templateId]],
        single: true
      });

      if (existing) {
        await sbUpdate('ratings', existing.id, { score });
      } else {
        await sbInsert('ratings', { user_id: user.id, template_id: templateId, score });
      }
      sbLog.ok('Templates: rating saved', { templateId, score });
      return true;
    } catch (err) {
      sbLog.error('Templates: rate failed', err);
      throw err;
    }
  }
};
