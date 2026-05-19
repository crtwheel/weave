// SEO Helper — Dynamically set meta tags
// Usage: seo.set({ title: 'My Page', description: '...', image: '...' })

window.seo = {
  set: function (opts) {
    if (opts.title) this.title(opts.title);
    if (opts.description) this.description(opts.description);
    if (opts.image) this.image(opts.image);
    if (opts.url) this.url(opts.url);
    if (opts.keywords) this.keywords(opts.keywords);
    if (opts.type) this.type(opts.type);
  },

  title: function (text) {
    var full = text + ' | Weave';
    document.title = full;
    this._setMeta('og:title', text);
    this._setMeta('twitter:title', text);
  },

  description: function (text) {
    this._setMeta('description', text);
    this._setMeta('og:description', text);
    this._setMeta('twitter:description', text);
  },

  image: function (url) {
    this._setMeta('og:image', url);
    this._setMeta('twitter:image', url);
  },

  url: function (url) {
    this._setMeta('og:url', url);
    this._setMeta('twitter:url', url);
  },

  keywords: function (text) {
    this._setMeta('keywords', text);
  },

  type: function (text) {
    this._setMeta('og:type', text);
  },

  _setMeta: function (name, content) {
    if (!content) return;
    var selector = 'meta[name="' + name + '"], meta[property="' + name + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      if (name.startsWith('og:') || name.startsWith('twitter:')) {
        el.setAttribute('property', name);
      } else {
        el.setAttribute('name', name);
      }
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  },

  reset: function () {
    document.title = 'Weave — Retro-Futuristic Template Shop';
    this.set({
      description: 'Discover premium web templates with a retro-futuristic twist. Browse, purchase, and download beautiful templates.',
      image: '',
      url: window.location.origin,
      type: 'website'
    });
  }
};
