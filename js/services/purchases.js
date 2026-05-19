/**
 * Purchase management service — create, list, verify, and download purchases.
 * @namespace
 */
const sbPurchases = {
  /**
   * Create a new purchase record for the current user.
   * @param {Object} data - Purchase data including template_id and transaction details.
   * @param {string|number} data.template_id - The ID of the template being purchased.
   * @returns {Promise<Object>} The created purchase record.
   * @throws {Error} If not authenticated or validation fails.
   */
  create: async (data) => {
    try {
      const user = await sbGetUser();
      if (!user) throw new Error('Not authenticated');
      const valid = sbValidate.required(data.template_id, 'Template ID');
      if (valid !== true) throw new Error(valid);

      const result = await sbInsert('purchases', {
        ...data,
        user_id: user.id,
        created_at: new Date().toISOString()
      });
      sbLog.ok('Purchases: created', result);
      return result;
    } catch (err) {
      sbLog.error('Purchases: create failed', err);
      throw err;
    }
  },

  /**
   * List all purchases for the current user, including related template data.
   * @returns {Promise<Object[]>} Array of purchase records with nested template objects.
   * @throws {Error} If the database query fails.
   */
  list: async () => {
    try {
      const user = await sbGetUser();
      if (!user) return [];
      return await sbSelect('purchases', {
        eq: ['user_id', user.id],
        select: '*,template:templates(*)',
        order: 'created_at',
        orderDir: 'desc'
      });
    } catch (err) {
      sbLog.error('Purchases: list failed', err);
      throw err;
    }
  },

  /**
   * Get a signed download URL for a purchased template and track the download.
   * @param {string|number} templateId - The template's ID.
   * @returns {Promise<string>} A signed download URL for the template file.
   * @throws {Error} If the template is not found, has no storage path, or the request fails.
   */
  getDownloadUrl: async (templateId) => {
    try {
      const template = await sbSelect('templates', { eq: ['id', templateId], single: true });
      if (!template) throw new Error('Template not found');
      if (!template.storage_path) throw new Error('No storage path for this template');

      const url = await sbStorage.signedUrl(template.storage_path);
      await sbPurchases.trackDownload(templateId);
      sbLog.ok('Purchases: download URL generated', templateId);
      return url;
    } catch (err) {
      sbLog.error('Purchases: get download URL failed', err);
      throw err;
    }
  },

  /**
   * Track a template download event in the download_logs table and increment the download counter.
   * @param {string|number} templateId - The template's ID.
   * @returns {Promise<void>}
   */
  trackDownload: async (templateId) => {
    try {
      const user = await sbGetUser();
      if (user?.id) {
        await sbInsert('download_logs', {
          template_id: templateId,
          user_id: user.id,
          created_at: new Date().toISOString()
        }).catch(() => {});
      }
      const template = await sbSelect('templates', { eq: ['id', templateId], single: true });
      if (template) {
        await sbUpdate('templates', templateId, { downloads: (template.downloads || 0) + 1 });
      }
      sbLog.ok('Purchases: download tracked', templateId);
    } catch (err) {
      sbLog.warn('Purchases: track download failed (table may not exist)', err);
    }
  },

  /**
   * Check if the current user has a verified purchase for a template.
   * @param {string|number} templateId - The template's ID.
   * @returns {Promise<boolean>} True if the user has a purchase with status 'verified'.
   */
  isVerified: async (templateId) => {
    try {
      const user = await sbGetUser();
      if (!user) return false;
      const purchase = await sbSelect('purchases', {
        eq: [['user_id', user.id], ['template_id', templateId]],
        single: true
      });
      return !!(purchase && purchase.status === 'verified');
    } catch (err) {
      sbLog.error('Purchases: verification check failed', err);
      return false;
    }
  }
};
