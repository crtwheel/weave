/**
 * Client-side analytics service for tracking page views and user events.
 * Provides lightweight event logging via console with structured category/action/label format.
 * For production, extend this to send events to a real analytics provider.
 * @namespace
 */
const sbAnalytics = {
  /**
   * Track a page view event with current URL and referrer info.
   * Logs the current window location path, full URL, and HTTP referrer if available.
   * Call this on every page load or route change to track navigation.
   * @example
   * sbAnalytics.trackPageView();
   * // Logs: [Weave] ℹ️ Analytics: page view { path: '/', url: 'https://...', referrer: '...' }
   */
  trackPageView: () => {
    sbLog.info('Analytics: page view', {
      path: window.location.pathname,
      url: window.location.href,
      referrer: document.referrer || null
    });
  },

  /**
   * Track a template download event and delegate to purchases tracking.
   * Fires a local analytics event and also delegates to sbPurchases.trackDownload
   * for server-side download logging and counter increment.
   * @param {string|number} templateId - The ID of the downloaded template.
   * @example
   * sbAnalytics.trackDownload('abc-123');
   */
  trackDownload: (templateId) => {
    sbAnalytics.trackEvent('Download', 'click', `template_${templateId}`);
    if (typeof sbPurchases !== 'undefined') {
      sbPurchases.trackDownload(templateId).catch(err => {
        sbLog.error('Analytics: download track delegation failed', err);
      });
    }
  },

  /**
   * Track a search query event.
   * Logs the user's search term for analytics review.
   * @param {string} query - The search query string.
   * @example
   * sbAnalytics.trackSearch('saas landing page');
   */
  trackSearch: (query) => {
    sbAnalytics.trackEvent('Search', 'query', query);
  },

  /**
   * Track a generic analytics event with category/action/label structure.
   * Standard event taxonomy used by most analytics platforms.
   * Category groups related events, action describes the interaction,
   * and label provides additional context.
   * @param {string} category - Event category (e.g. 'Download', 'Search', 'Purchase').
   * @param {string} action - Event action (e.g. 'click', 'query', 'submit').
   * @param {string} [label] - Optional event label for additional context.
   * @example
   * sbAnalytics.trackEvent('Purchase', 'submit', 'template_saas-landing');
   */
  trackEvent: (category, action, label) => {
    sbLog.info(`Analytics: ${category}/${action}`, label || '');
  }
};
