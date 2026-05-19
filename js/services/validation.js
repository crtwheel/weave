/**
 * Validation service for form inputs and data integrity.
 * @namespace
 */
const sbValidate = {
  /**
   * Validate an email address format.
   * @param {*} value - The value to validate.
   * @returns {true|string} True if valid, or an error message string.
   */
  email: (value) => {
    if (!value || typeof value !== 'string') {
      sbLog.warn('Validation: email is required');
      return 'Email is required';
    }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (!valid) sbLog.warn('Validation: invalid email', value);
    return valid ? true : 'Invalid email address';
  },

  /**
   * Validate an Ethereum transaction hash format (0x + 64 hex chars).
   * @param {*} hash - The transaction hash to validate.
   * @returns {true|string} True if valid, or an error message string.
   */
  txHash: (hash) => {
    if (!hash || typeof hash !== 'string') {
      sbLog.warn('Validation: tx hash is required');
      return 'Transaction hash is required';
    }
    const valid = /^0x[a-fA-F0-9]{64}$/.test(hash.trim());
    if (!valid) sbLog.warn('Validation: invalid tx hash', hash);
    return valid ? true : 'Invalid transaction hash (must be 0x + 64 hex chars)';
  },

  /**
   * Validate an Ethereum wallet address format (0x + 40 hex chars).
   * @param {*} address - The wallet address to validate.
   * @returns {true|string} True if valid, or an error message string.
   */
  wallet: (address) => {
    if (!address || typeof address !== 'string') {
      sbLog.warn('Validation: wallet address is required');
      return 'Wallet address is required';
    }
    const valid = /^0x[a-fA-F0-9]{40}$/.test(address.trim());
    if (!valid) sbLog.warn('Validation: invalid wallet address', address);
    return valid ? true : 'Invalid wallet address (must be 0x + 40 hex chars)';
  },

  /**
   * Validate a password meets minimum length requirements.
   * @param {*} pass - The password to validate.
   * @returns {true|string} True if valid, or an error message string.
   */
  password: (pass) => {
    if (!pass || typeof pass !== 'string') {
      sbLog.warn('Validation: password is required');
      return 'Password is required';
    }
    const valid = pass.length >= 6;
    if (!valid) sbLog.warn('Validation: password too short');
    return valid ? true : 'Password must be at least 6 characters';
  },

  /**
   * Validate that a required field has a value.
   * @param {*} value - The value to check.
   * @param {string} fieldName - Display name for the field in error messages.
   * @returns {true|string} True if present, or an error message string.
   */
  required: (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
      sbLog.warn(`Validation: ${fieldName} is required`);
      return `${fieldName} is required`;
    }
    return true;
  },

  /**
   * Validate a URL string is parseable.
   * @param {*} url - The URL to validate.
   * @returns {true|string} True if valid, or an error message string.
   */
  url: (url) => {
    if (!url || typeof url !== 'string') {
      sbLog.warn('Validation: URL is required');
      return 'URL is required';
    }
    try {
      new URL(url);
      return true;
    } catch {
      sbLog.warn('Validation: invalid URL', url);
      return 'Invalid URL';
    }
  }
};
