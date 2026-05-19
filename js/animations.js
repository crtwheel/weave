/* Weave Scroll Animations — IntersectionObserver-based reveal */

(function() {
  'use strict';

  var defaultConfig = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  var variants = {
    'fade-in':        { opacity: '0', transform: 'none' },
    'slide-up':       { opacity: '0', transform: 'translateY(30px)' },
    'slide-down':     { opacity: '0', transform: 'translateY(-30px)' },
    'slide-left':     { opacity: '0', transform: 'translateX(30px)' },
    'slide-right':    { opacity: '0', transform: 'translateX(-30px)' },
    'scale-in':       { opacity: '0', transform: 'scale(0.92)' }
  };

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var variant = el.dataset.reveal || 'fade-in';
      var delay = parseInt(el.dataset.delay, 10) || 0;

      var base = variants[variant] || variants['fade-in'];
      Object.assign(el.style, {
        opacity: base.opacity,
        transform: base.transform,
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        transitionDelay: delay + 'ms'
      });

      requestAnimationFrame(function() {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });

      observer.unobserve(el);
    });
  }, defaultConfig);

  /* Staggered children reveal */
  function staggerReveal(root, staggerMs) {
    var children = root.querySelectorAll('.reveal-stagger > *');
    children.forEach(function(el, i) {
      el.classList.add('reveal');
      el.dataset.delay = String((staggerMs || 80) * i);
      observer.observe(el);
    });
  }

  /* Re-observe elements added to the DOM after initial load */
  function observeNew(root) {
    var els = (root || document).querySelectorAll('.reveal:not([data-observed])');
    els.forEach(function(el) {
      el.dataset.observed = 'true';
      observer.observe(el);
    });
  }

  /* Animate counter elements that have data-target attribute */
  function animateCounters(root) {
    var counters = (root || document).querySelectorAll('[data-counter]');
    counters.forEach(function(el) {
      var target = parseFloat(el.dataset.counter);
      if (isNaN(target)) return;
      var suffix = el.dataset.suffix || '';
      var duration = parseInt(el.dataset.duration, 10) || 1500;
      var startTime = performance.now();

      function update(currentTime) {
        var elapsed = currentTime - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = eased * target;
        el.textContent = Math.round(current) + suffix;
        if (progress < 1) requestAnimationFrame(update);
        else el.textContent = target + suffix;
      }
      requestAnimationFrame(update);
    });
  }

  function init() {
    var els = document.querySelectorAll('.reveal');
    if (els.length === 0) return;
    els.forEach(function(el) {
      el.dataset.observed = 'true';
      observer.observe(el);
    });
    staggerReveal(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WeaveAnimations = {
    observe: function(root) { observeNew(root || document); },
    stagger: function(root, ms) { staggerReveal(root || document, ms); },
    counters: function(root) { animateCounters(root || document); },
    destroy: function() {
      observer.disconnect();
    },
    refresh: function() {
      observer.disconnect();
      observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var variant = el.dataset.reveal || 'fade-in';
          var delay = parseInt(el.dataset.delay, 10) || 0;
          var base = variants[variant] || variants['fade-in'];
          Object.assign(el.style, {
            opacity: base.opacity,
            transform: base.transform,
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            transitionDelay: delay + 'ms'
          });
          requestAnimationFrame(function() {
            el.style.opacity = '1';
            el.style.transform = 'none';
          });
          observer.unobserve(el);
        });
      }, defaultConfig);
      observeNew(document);
    }
  };
})();