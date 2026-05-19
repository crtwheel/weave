let _toastContainer = null;
function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    _toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Toast and confirmation dialog notification service.
 * @namespace
 */
const sbNotify = {
  /**
   * Internal helper to render and animate a toast notification.
   * @param {string} msg - The message text to display.
   * @param {string} type - Toast style class suffix (success, error, info, warning).
   * @private
   */
  _show: (msg, type) => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    toast.style.cssText = 'transform:translateY(-20px);opacity:0;transition:all 0.3s ease;pointer-events:auto;padding:12px 20px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:380px;word-break:break-word;';
    _getToastContainer().appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });
    const dismiss = () => {
      toast.style.transform = 'translateY(-20px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    };
    setTimeout(dismiss, 3000);
    toast.addEventListener('click', dismiss);
  },

  /**
   * Show a success toast notification.
   * @param {string} msg - The success message to display.
   */
  success: (msg) => sbNotify._show(msg, 'success'),

  /**
   * Show an error toast notification.
   * @param {string} msg - The error message to display.
   */
  error: (msg) => sbNotify._show(msg, 'error'),

  /**
   * Show an info toast notification.
   * @param {string} msg - The info message to display.
   */
  info: (msg) => sbNotify._show(msg, 'info'),

  /**
   * Show a warning toast notification.
   * @param {string} msg - The warning message to display.
   */
  warning: (msg) => sbNotify._show(msg, 'warning'),

  /**
   * Show a confirmation dialog that resolves with a boolean.
   * @param {string} msg - The confirmation question to display.
   * @returns {Promise<boolean>} Resolves true if user clicked Yes, false otherwise.
   */
  confirm: (msg) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div class="confirm-dialog" style="background:#fff;border-radius:12px;padding:24px;min-width:320px;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;">
          <p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.5;">${msg}</p>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-confirm-yes" style="padding:10px 24px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-size:14px;cursor:pointer;">Yes</button>
            <button class="btn btn-confirm-no" style="padding:10px 24px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#666;font-size:14px;cursor:pointer;">No</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const cleanup = () => overlay.remove();
      overlay.querySelector('.btn-confirm-yes').onclick = () => { cleanup(); resolve(true); };
      overlay.querySelector('.btn-confirm-no').onclick = () => { cleanup(); resolve(false); };
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { cleanup(); resolve(false); } });
    });
  }
};
