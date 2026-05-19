/**
 * Authentication service wrapping Supabase Auth with session management and role checks.
 * @namespace
 */
const sbAuth = {
  /**
   * Fetch the current authenticated user along with their profile data.
   * @returns {Promise<Object|null>} Combined user + profile object, or null if not authenticated.
   */
  getUser: async () => {
    try {
      const user = await sbGetUser();
      if (!user) return null;
      const profile = await sbSelect('profiles', { eq: ['id', user.id], single: true });
      sbLog.ok('Auth: user fetched', user.email);
      return { ...user, ...(profile || {}) };
    } catch (err) {
      sbLog.error('Auth: get user failed', err);
      return null;
    }
  },

  /**
   * Check if a valid session exists and redirect to dashboard if not.
   * @returns {boolean} True if authenticated, false otherwise.
   */
  requireAuth: () => {
    const session = sbGetSession();
    if (!session) {
      sbLog.warn('Auth: no session, redirecting');
      window.location.href = '/dashboard.html';
      return false;
    }
    return true;
  },

  /**
   * Check if the current user has a specific role, redirecting on failure.
   * @param {string} role - The required role name (e.g. 'admin', 'superadmin').
   * @returns {Promise<boolean>} True if user has the required role, false otherwise.
   */
  requireRole: async (role) => {
    try {
      const user = await sbGetUser();
      if (!user) {
        window.location.href = '/dashboard.html';
        return false;
      }
      const profile = await sbSelect('profiles', { eq: ['id', user.id], single: true });
      if (!profile || profile.role !== role) {
        sbLog.warn(`Auth: insufficient role (need ${role})`, profile?.role);
        window.location.href = '/dashboard.html';
        return false;
      }
      return true;
    } catch (err) {
      sbLog.error('Auth: role check failed', err);
      window.location.href = '/dashboard.html';
      return false;
    }
  },

  /**
   * Register a new user with email/password and create their profile record.
   * @param {string} email - User's email address.
   * @param {string} password - User's password (min 6 chars).
   * @returns {Promise<Object>} The auth response data.
   * @throws {Error} If validation fails or sign-up API returns an error.
   */
  signUp: async (email, password) => {
    const emailValid = sbValidate.email(email);
    if (emailValid !== true) throw new Error(emailValid);
    const passValid = sbValidate.password(password);
    if (passValid !== true) throw new Error(passValid);

    try {
      const data = await sbSignUp(email, password);
      const userId = data.user?.id || data.id;
      if (userId) {
        await sbInsert('profiles', { id: userId, email, role: 'user', created_at: new Date().toISOString() });
      }
      sbLog.ok('Auth: sign up success', email);
      return data;
    } catch (err) {
      sbLog.error('Auth: sign up failed', err);
      throw err;
    }
  },

  /**
   * Sign in an existing user with email and password.
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   * @returns {Promise<Object>} The auth response data with session tokens.
   * @throws {Error} If validation fails or sign-in fails.
   */
  signIn: async (email, password) => {
    const emailValid = sbValidate.email(email);
    if (emailValid !== true) throw new Error(emailValid);
    const passValid = sbValidate.password(password);
    if (passValid !== true) throw new Error(passValid);

    try {
      const data = await sbSignIn(email, password);
      sbLog.ok('Auth: sign in success', email);
      return data;
    } catch (err) {
      sbLog.error('Auth: sign in failed', err);
      throw err;
    }
  },

  /**
   * Sign out the current user and clear all cached data.
   * @returns {Promise<void>}
   */
  signOut: async () => {
    try {
      await sbSignOut();
      sbCache.clear();
      sbLog.ok('Auth: sign out success');
    } catch (err) {
      sbLog.error('Auth: sign out failed', err);
    }
  },

  /**
   * Update the current user's profile record.
   * @param {Object} data - Key-value pairs of profile fields to update.
   * @returns {Promise<Object>} The updated profile record(s).
   * @throws {Error} If not authenticated or the update fails.
   */
  updateProfile: async (data) => {
    try {
      const user = await sbGetUser();
      if (!user) throw new Error('Not authenticated');
      const result = await sbUpdate('profiles', user.id, { ...data, updated_at: new Date().toISOString() });
      sbLog.ok('Auth: profile updated');
      return result;
    } catch (err) {
      sbLog.error('Auth: update profile failed', err);
      throw err;
    }
  },

  /**
   * Check if the current user has been banned.
   * @returns {Promise<boolean>} True if the user's profile has a banned_at timestamp.
   */
  isBanned: async () => {
    try {
      const user = await sbGetUser();
      if (!user) return false;
      const profile = await sbSelect('profiles', { eq: ['id', user.id], single: true });
      if (profile?.banned_at) {
        sbLog.warn('Auth: user is banned', user.email);
        return true;
      }
      return false;
    } catch (err) {
      sbLog.error('Auth: ban check failed', err);
      return false;
    }
  }
};
