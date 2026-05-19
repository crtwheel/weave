// Simple hash router for admin panel
// Usage: router.set('/admin', () => showPage('admin'))
//        router.set('/admin/users', () => showPage('users'))
//        router.navigate('/admin/users')

window.router = {
  _routes: {},
  _current: null,

  set: function (path, handler) {
    this._routes[path] = handler;
  },

  get: function (path) {
    return this._routes[path];
  },

  remove: function (path) {
    delete this._routes[path];
  },

  navigate: function (path) {
    window.location.hash = '#' + path;
  },

  resolve: function (hash) {
    var path = hash.replace(/^#/, '') || '/';
    var handler = this._routes[path];
    if (handler) {
      this._current = path;
      handler();
    } else {
      var catchAll = this._routes['*'];
      if (catchAll) catchAll(path);
    }
  },

  start: function () {
    var self = this;
    var onHashChange = function () { return self.resolve(window.location.hash); };
    window.addEventListener('hashchange', onHashChange);
    if (window.location.hash) {
      self.resolve(window.location.hash);
    } else {
      self.navigate('/');
    }
    return function () { return window.removeEventListener('hashchange', onHashChange); };
  },

  current: function () {
    return this._current || window.location.hash.replace(/^#/, '') || '/';
  },

  back: function () {
    window.history.back();
  },

  replace: function (path) {
    window.location.replace('#' + path);
  }
};
