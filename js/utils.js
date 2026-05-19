// Weave Utilities — Helper functions for the template shop

window.formatWallet = function formatWallet(address) {
  if (!address) return '';
  if (address.length > 10) return address.slice(0, 6) + '...' + address.slice(-4);
  return address;
};

window.timeAgo = function timeAgo(date) {
  if (!date) return '';
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return weeks + 'w ago';
  const months = Math.floor(days / 30);
  if (months < 12) return months + 'mo ago';
  const years = Math.floor(days / 365);
  return years + 'y ago';
};

window.formatDate = function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

window.formatNumber = function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString();
};

window.formatPrice = function formatPrice(amount, currency) {
  if (currency === void 0) currency = 'USD';
  if (amount === null || amount === undefined) return '$0.00';
  const symbols = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', ETH: '\u039E', BTC: '\u0243' };
  const sym = symbols[currency] || currency + ' ';
  return sym + Number(amount).toFixed(2);
};

window.copyToClipboard = async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
};

window.debounce = function debounce(fn, delay) {
  if (delay === void 0) delay = 300;
  let timer;
  return function () {
    var args = [], len = arguments.length;
    while (len--) args[len] = arguments[len];
    clearTimeout(timer);
    timer = setTimeout(function () { return fn.apply(void 0, args); }, delay);
  };
};

window.throttle = function throttle(fn, limit) {
  if (limit === void 0) limit = 200;
  let inThrottle = false;
  return function () {
    var args = [], len = arguments.length;
    while (len--) args[len] = arguments[len];
    if (!inThrottle) {
      fn.apply(void 0, args);
      inThrottle = true;
      setTimeout(function () { return inThrottle = false; }, limit);
    }
  };
};

window.generateId = function generateId() {
  return Math.random().toString(36).substring(2, 10);
};

window.getUrlParams = function getUrlParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
};

window.truncate = function truncate(str, max) {
  if (max === void 0) max = 100;
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
};

window.sanitize = function sanitize(str) {
  if (!str) return '';
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
};

window.isValidFileExt = function isValidFileExt(filename, exts) {
  if (exts === void 0) exts = ['.zip'];
  if (!filename) return false;
  var lower = filename.toLowerCase();
  return exts.some(function (ext) { return lower.endsWith(ext.toLowerCase()); });
};

window.formatBytes = function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i >= units.length) i = units.length - 1;
  return Number((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + units[i];
};

window.getInitials = function getInitials(str) {
  if (!str) return '?';
  var name = str.split('@')[0];
  return name.slice(0, 2).toUpperCase() || '?';
};

window.scrollTo = function scrollTo(el) {
  if (!el) return;
  var target = typeof el === 'string' ? document.querySelector(el) : el;
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.isInViewport = function isInViewport(el) {
  if (!el) return false;
  var rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
};

window.parseJwt = function parseJwt(token) {
  if (!token) return null;
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    var decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

window.isMobile = function isMobile() {
  return window.innerWidth < 768;
};

window.addBodyClass = function addBodyClass(cls) {
  document.body.classList.add(cls);
};

window.removeBodyClass = function removeBodyClass(cls) {
  document.body.classList.remove(cls);
};

window.toggleBodyClass = function toggleBodyClass(cls) {
  document.body.classList.toggle(cls);
};

window.storage = {
  get: function (key) {
    try {
      return JSON.parse(localStorage.getItem('weave-' + key));
    } catch {
      return null;
    }
  },
  set: function (key, val) {
    try {
      localStorage.setItem('weave-' + key, JSON.stringify(val));
    } catch {}
  },
  remove: function (key) {
    localStorage.removeItem('weave-' + key);
  },
  clear: function () {
    Object.keys(localStorage).filter(function (k) { return k.startsWith('weave-'); }).forEach(function (k) { return localStorage.removeItem(k); });
  }
};

window.showToast = function showToast(message, type) {
  if (type === void 0) type = 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(function () { return toast.remove(); }, 300);
  }, 3000);
};

window.showModal = function showModal(config) {
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML =
    '<div class="modal">' +
    '<div class="modal-header">' +
    '<span>' + window.sanitize(config.title || '') + '</span>' +
    '<button class="modal-close-btn" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--text-secondary);padding:0.25rem;">\u00D7</button>' +
    '</div>' +
    '<div class="modal-body">' + window.sanitize(config.body || '') + '</div>' +
    (config.actions ? '<div class="modal-footer">' + config.actions.map(function (a) { return '<button class="btn btn-' + (a.variant || 'primary') + ' btn-sm modal-action" data-action="' + a.label + '">' + a.label + '</button>'; }).join('') + '</div>' : '') +
    '</div>';
  document.body.appendChild(backdrop);
  var closeBtn = backdrop.querySelector('.modal-close-btn');
  if (closeBtn) closeBtn.onclick = function () { return backdrop.remove(); };
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
  var actionBtns = backdrop.querySelectorAll('.modal-action');
  actionBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = config.actions.find(function (a) { return a.label === btn.dataset.action; });
      if (action && action.handler) action.handler();
      backdrop.remove();
    });
  });
  return backdrop;
};

window.validateEmail = function validateEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

window.validatePassword = function validatePassword(password) {
  if (!password) return false;
  return password.length >= 8;
};

window.getFileIcon = function getFileIcon(filename) {
  if (!filename) return '\uD83D\uDCC1';
  var ext = filename.split('.').pop().toLowerCase();
  var icons = {
    zip: '\uD83D\uDCE6', rar: '\uD83D\uDCE6', '7z': '\uD83D\uDCE6', tar: '\uD83D\uDCE6', gz: '\uD83D\uDCE6',
    pdf: '\uD83D\uDCC4', doc: '\uD83D\uDCDD', docx: '\uD83D\uDCDD',
    jpg: '\uD83D\uDDBC', jpeg: '\uD83D\uDDBC', png: '\uD83D\uDDBC', gif: '\uD83C\uDFAC', svg: '\uD83D\uDD8C',
    mp4: '\uD83C\uDFA5', webm: '\uD83C\uDFA5',
    mp3: '\uD83C\uDFB5', wav: '\uD83C\uDFB5',
    html: '\uD83C\uDF10', css: '\uD83C\uDFA8', js: '\uD83D\uDCBB', json: '\uD83D\uDCCA',
  };
  return icons[ext] || '\uD83D\uDCC1';
};

window.ratingToStars = function ratingToStars(rating) {
  if (!rating && rating !== 0) return '';
  var full = Math.floor(rating);
  var half = rating % 1 >= 0.5 ? 1 : 0;
  var empty = 5 - full - half;
  return (
    '\u2605'.repeat(full) +
    (half ? '\u00BD' : '') +
    '\u2606'.repeat(empty)
  );
};

window.escapeRegExp = function escapeRegExp(str) {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

window.clamp = function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
};

window.randomBetween = function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

window.shuffleArray = function shuffleArray(arr) {
  if (!Array.isArray(arr)) return [];
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var _ref = [a[j], a[i]];
    a[i] = _ref[0];
    a[j] = _ref[1];
  }
  return a;
};

window.pluralize = function pluralize(count, singular, plural) {
  if (plural === void 0) plural = singular + 's';
  return count === 1 ? singular : plural;
};

window.countryFlag = function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  var base = 127397;
  return String.fromCodePoint(code.charCodeAt(0) + base, code.charCodeAt(1) + base);
};

window.openInNewTab = function openInNewTab(url) {
  if (!url) return;
  var a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
};

window.downloadFile = function downloadFile(url, filename) {
  var a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.once = function once(fn) {
  var called = false;
  return function () {
    var args = [], len = arguments.length;
    while (len--) args[len] = arguments[len];
    if (called) return;
    called = true;
    return fn.apply(void 0, args);
  };
};
