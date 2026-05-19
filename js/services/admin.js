/**
 * Admin panel service — user, purchase, template, and system management.
 * @namespace
 */
const sbAdmin = {
  /**
   * List all user profiles with their auth email.
   * @returns {Promise<Object[]>} Array of profile objects with nested auth_users data.
   * @throws {Error} If the database query fails.
   */
  listUsers: async () => {
    try {
      const data = await sbSelect('profiles', { select: '*,auth_users:auth.users(email)' });
      sbLog.ok('Admin: users listed', { count: data.length });
      return data;
    } catch (err) {
      sbLog.error('Admin: list users failed', err);
      throw err;
    }
  },

  /**
   * Update a user's role.
   * @param {string} userId - The user's profile ID (UUID).
   * @param {string} role - The new role name (e.g. 'user', 'admin', 'superadmin').
   * @returns {Promise<Object>} The updated profile record(s).
   * @throws {Error} If validation fails or the update request fails.
   */
  updateUserRole: async (userId, role) => {
    try {
      const valid = sbValidate.required(role, 'Role');
      if (valid !== true) throw new Error(valid);
      const result = await sbUpdate('profiles', userId, { role, updated_at: new Date().toISOString() });
      sbLog.ok('Admin: user role updated', { userId, role });
      return result;
    } catch (err) {
      sbLog.error('Admin: update role failed', err);
      throw err;
    }
  },

  /**
   * Ban a user by setting their banned_at timestamp.
   * @param {string} userId - The user's profile ID (UUID).
   * @returns {Promise<Object>} The updated profile record(s).
   * @throws {Error} If the update request fails.
   */
  banUser: async (userId) => {
    try {
      const result = await sbUpdate('profiles', userId, { banned_at: new Date().toISOString() });
      sbLog.ok('Admin: user banned', userId);
      return result;
    } catch (err) {
      sbLog.error('Admin: ban user failed', err);
      throw err;
    }
  },

  /**
   * Unban a user by clearing their banned_at timestamp.
   * @param {string} userId - The user's profile ID (UUID).
   * @returns {Promise<Object>} The updated profile record(s).
   * @throws {Error} If the update request fails.
   */
  unbanUser: async (userId) => {
    try {
      const result = await sbUpdate('profiles', userId, { banned_at: null });
      sbLog.ok('Admin: user unbanned', userId);
      return result;
    } catch (err) {
      sbLog.error('Admin: unban user failed', err);
      throw err;
    }
  },

  /**
   * List all purchases with user and template relations.
   * @returns {Promise<Object[]>} Array of purchase objects with nested user and template data.
   * @throws {Error} If the database query fails.
   */
  listPurchases: async () => {
    try {
      const data = await sbSelect('purchases', {
        select: '*,user:profiles!user_id(*),template:templates(*)',
        order: 'created_at',
        orderDir: 'desc'
      });
      sbLog.ok('Admin: purchases listed', { count: data.length });
      return data;
    } catch (err) {
      sbLog.error('Admin: list purchases failed', err);
      throw err;
    }
  },

  /**
   * Update the status of a purchase (e.g. pending → verified → rejected).
   * @param {string|number} id - The purchase record ID.
   * @param {string} status - New status value (verified, rejected, pending).
   * @returns {Promise<Object>} The updated purchase record(s).
   * @throws {Error} If the update request fails.
   */
  updatePurchaseStatus: async (id, status) => {
    try {
      const result = await sbUpdate('purchases', id, { status, updated_at: new Date().toISOString() });
      sbLog.ok('Admin: purchase status updated', { id, status });
      return result;
    } catch (err) {
      sbLog.error('Admin: update purchase status failed', err);
      throw err;
    }
  },

  /**
   * List all templates ordered by creation date (cached).
   * @returns {Promise<Object[]>} Array of template objects.
   * @throws {Error} If the database query fails.
   */
  listTemplates: async () => {
    const cached = sbCache.get('admin_templates');
    if (cached) return cached;
    try {
      const data = await sbSelect('templates', { order: 'created_at', orderDir: 'desc' });
      sbCache.set('admin_templates', data, 30000);
      return data;
    } catch (err) {
      sbLog.error('Admin: list templates failed', err);
      throw err;
    }
  },

  /**
   * Create a new template record.
   * @param {Object} data - Template fields (name, slug, description, price, etc.).
   * @returns {Promise<Object>} The created template record.
   * @throws {Error} If the insert request fails.
   */
  createTemplate: async (data) => {
    try {
      const result = await sbInsert('templates', { ...data, created_at: new Date().toISOString() });
      sbCache.clear('admin_templates');
      sbLog.ok('Admin: template created', result);
      return result;
    } catch (err) {
      sbLog.error('Admin: create template failed', err);
      throw err;
    }
  },

  /**
   * Update an existing template record.
   * @param {string|number} id - The template's ID.
   * @param {Object} data - Template fields to update.
   * @returns {Promise<Object>} The updated template record(s).
   * @throws {Error} If the update request fails.
   */
  updateTemplate: async (id, data) => {
    try {
      const result = await sbUpdate('templates', id, { ...data, updated_at: new Date().toISOString() });
      sbCache.clear('admin_templates');
      sbLog.ok('Admin: template updated', id);
      return result;
    } catch (err) {
      sbLog.error('Admin: update template failed', err);
      throw err;
    }
  },

  /**
   * Delete a template if it has no associated purchases.
   * @param {string|number} id - The template's ID.
   * @returns {Promise<boolean>} True if deletion was successful.
   * @throws {Error} If the template has existing purchases or the delete request fails.
   */
  deleteTemplate: async (id) => {
    try {
      const purchases = await sbSelect('purchases', { eq: ['template_id', id] });
      if (purchases.length > 0) throw new Error('Cannot delete template with existing purchases');
      await sbDelete('templates', id);
      sbCache.clear('admin_templates');
      sbLog.ok('Admin: template deleted', id);
      return true;
    } catch (err) {
      sbLog.error('Admin: delete template failed', err);
      throw err;
    }
  },

  /**
   * Compute aggregate platform statistics (users, purchases, downloads, revenue).
   * @returns {Promise<{users: number, purchases: number, downloads: number, revenue: number}>} Stats object.
   * @throws {Error} If any of the database queries fail.
   */
  getStats: async () => {
    try {
      const [profiles, purchases, logs, templates] = await Promise.all([
        sbSelect('profiles', { select: 'id,created_at' }),
        sbSelect('purchases', { select: 'id,amount' }),
        sbSelect('download_logs', { select: 'id' }),
        sbSelect('templates', { select: 'id' })
      ]);
      const now = new Date();
      const thisMonth = profiles.filter(p => {
        const d = new Date(p.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;
      const stats = {
        total_users: profiles.length,
        total_templates: templates.length,
        total_purchases: purchases.length,
        total_revenue: purchases.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
        new_users_this_month: thisMonth,
        users: profiles.length,
        purchases: purchases.length,
        downloads: logs.length,
        revenue: purchases.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      };
      sbLog.ok('Admin: stats computed', stats);
      return stats;
    } catch (err) {
      sbLog.error('Admin: get stats failed', err);
      throw err;
    }
  },

  /**
   * Log an admin action to the audit trail.
   * @param {string} action - Action name (e.g. 'user_banned', 'template_created').
   * @param {string|Object} details - Additional context about the action.
   * @returns {Promise<void>}
   */
  logAction: async (action, details) => {
    try {
      const user = await sbGetUser();
      await sbInsert('audit_logs', {
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        user_id: user?.id || null,
        created_at: new Date().toISOString()
      });
      sbLog.ok('Admin: action logged', action);
    } catch (err) {
      sbLog.error('Admin: log action failed', err);
    }
  },

  /**
   * Retrieve all audit log entries ordered by creation date descending.
   * @returns {Promise<Object[]>} Array of audit log entries.
   * @throws {Error} If the database query fails.
   */
  getAuditLogs: async () => {
    try {
      const data = await sbSelect('audit_logs', { order: 'created_at', orderDir: 'desc' });
      return data;
    } catch (err) {
      sbLog.error('Admin: get audit logs failed', err);
      throw err;
    }
  },

  /**
   * Get all feature flags (cached).
   * @returns {Promise<Object[]>} Array of feature flag objects with key/value pairs.
   * @throws {Error} If the database query fails.
   */
  getFeatureFlags: async () => {
    const cached = sbCache.get('feature_flags');
    if (cached) return cached;
    try {
      const data = await sbSelect('feature_flags');
      sbCache.set('feature_flags', data, 60000);
      return data;
    } catch (err) {
      sbLog.error('Admin: get feature flags failed', err);
      throw err;
    }
  },

  /**
   * Set or create a feature flag by key/value.
   * @param {string} key - The feature flag key.
   * @param {string} value - The feature flag value.
   * @returns {Promise<boolean>} True if the flag was saved.
   * @throws {Error} If the database operation fails.
   */
  setFeatureFlag: async (key, value) => {
    try {
      const existing = await sbSelect('feature_flags', { eq: ['key', key], single: true });
      if (existing) {
        await sbUpdate('feature_flags', existing.id, { value, updated_at: new Date().toISOString() });
      } else {
        await sbInsert('feature_flags', { key, value, created_at: new Date().toISOString() });
      }
      sbCache.clear('feature_flags');
      sbLog.ok('Admin: feature flag set', { key, value });
      return true;
    } catch (err) {
      sbLog.error('Admin: set feature flag failed', err);
      throw err;
    }
  },

  /**
   * Get all active announcements ordered by creation date descending.
   * @returns {Promise<Object[]>} Array of active announcement objects.
   * @throws {Error} If the database query fails.
   */
  getAnnouncements: async () => {
    try {
      const data = await sbSelect('announcements', { eq: ['active', true], order: 'created_at', orderDir: 'desc' });
      return data;
    } catch (err) {
      sbLog.error('Admin: get announcements failed', err);
      throw err;
    }
  },

  /**
   * Create a new announcement.
   * @param {Object} data - Announcement fields (title, message, active, etc.).
   * @returns {Promise<Object>} The created announcement record.
   * @throws {Error} If the insert request fails.
   */
  createAnnouncement: async (data) => {
    try {
      const result = await sbInsert('announcements', { ...data, created_at: new Date().toISOString() });
      sbLog.ok('Admin: announcement created');
      return result;
    } catch (err) {
      sbLog.error('Admin: create announcement failed', err);
      throw err;
    }
  },

  deleteAnnouncement: async (id) => {
    try {
      await sbDelete('announcements', id);
      sbLog.ok('Admin: announcement deleted', id);
      return true;
    } catch (err) {
      sbLog.error('Admin: delete announcement failed', err);
      throw err;
    }
  }
};
