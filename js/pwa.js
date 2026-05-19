// Weave PWA — Service Worker Registration & Offline Support

(function() {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    sbLog.warn('PWA: Service workers not supported in this browser');
    return;
  }

  /**
   * Register the service worker and log the result.
   */
  function registerSW() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
      sbLog.ok('PWA: Service worker registered', reg.scope);

      reg.addEventListener('updatefound', function() {
        var installing = reg.installing;
        sbLog.info('PWA: New service worker installing');

        installing.addEventListener('statechange', function() {
          if (installing.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              sbLog.info('PWA: Update available — refresh to activate');
            } else {
              sbLog.info('PWA: Content cached for offline use');
            }
          }
        });
      });
    }).catch(function(err) {
      sbLog.warn('PWA: Service worker registration failed', err);
    });
  }

  /**
   * Update online/offline status indicators.
   */
  function updateOnlineStatus() {
    var body = document.body;
    if (navigator.onLine) {
      body.classList.remove('is-offline');
      sbLog.info('PWA: Network status — online');
    } else {
      body.classList.add('is-offline');
      sbLog.warn('PWA: Network status — offline');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      registerSW();
      updateOnlineStatus();
    });
  } else {
    registerSW();
    updateOnlineStatus();
  }

  /**
   * Listen for service worker lifecycle changes.
   */
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    sbLog.info('PWA: New service worker activated');
  });

  /**
   * Expose PWA helpers globally.
   */
  window.WeavePWA = {
    register: registerSW,
    isOnline: function() { return navigator.onLine; },
    isSupported: function() { return 'serviceWorker' in navigator; }
  };
})();
