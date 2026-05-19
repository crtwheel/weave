/**
 * Supabase storage service for file URL generation and listing.
 * @namespace
 */
const sbStorage = {
  /**
   * Generate a signed (temporary, authenticated) URL for a private storage file.
   * @param {string} path - The file path within the template-files bucket.
   * @param {number} [expiresIn=3600] - URL expiration time in seconds (default 1 hour).
   * @returns {Promise<string>} The signed URL string.
   * @throws {Error} If the user is not authenticated or the request fails.
   */
  signedUrl: async (path, expiresIn = 3600) => {
    try {
      const url = await sbSignedUrl(path, expiresIn);
      sbLog.ok('Storage: signed URL generated', path);
      return url;
    } catch (err) {
      sbLog.error('Storage: signed URL failed', err);
      throw err;
    }
  },

  /**
   * Build a public (unauthenticated) URL for a storage file.
   * @param {string} path - The file path within the template-files bucket.
   * @returns {string} The full public URL string.
   */
  publicUrl: (path) => {
    try {
      const url = sbPublicUrl(path);
      sbLog.info('Storage: public URL', path);
      return url;
    } catch (err) {
      sbLog.error('Storage: public URL failed', err);
      throw err;
    }
  },

  /**
   * List files in a storage directory prefix.
   * @param {string} [path=''] - The prefix/directory path to list.
   * @returns {Promise<Object[]>} Array of file objects with name, id, metadata.
   * @throws {Error} If not authenticated or the request fails.
   */
  listFiles: async (path = '') => {
    try {
      const session = sbGetSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/template-files`, {
        method: 'POST',
        headers: sbHeaders(session.access_token),
        body: JSON.stringify({ prefix: path, limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })
      });
      if (!res.ok) throw new Error('List files failed');
      const data = await res.json();
      sbLog.ok('Storage: listed files', path);
      return data;
    } catch (err) {
      sbLog.error('Storage: list files failed', err);
      throw err;
    }
  }
};
