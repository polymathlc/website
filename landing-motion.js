/* Scroll-driven motion for the public home page (#landingPage).
   Progressive enhancement: with no JS, no IntersectionObserver or a
   reduced-motion preference, nothing is hidden and nothing moves. */
(function () {
  'use strict';
  var root = document.getElementById('landingPage');
  if (!root) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var GROUPS = [
    '.lp-capabilities .lp-wrap > span',
    '.lp-why-grid > *', '.lp-why-modes > *', '.lp-feature-grid > *',
    '.lp-steps > *', '.lp-about-method > li', '.lp-about-programmes > *',
    '.lp-teacher-list > *', '.lp-faq-list > *'
  ];
  var SINGLES = [
    '.lp-section-head', '.lp-demo-grid > *', '.lp-game-card', '.lp-teacher-card',
    '.lp-about-story', '.lp-about-contact', '.lp-faq-intro', '.lp-closing-inner',
    '.lp-experiment', '.lp-worked', '.lp-extras'
  ];

  var targets = [];
  function mark(el, i) {
    if (el.hasAttribute('data-lp-reveal')) return;
    el.setAttribute('data-lp-reveal', '');
    el.style.setProperty('--lp-i', Math.min(i, 6));
    targets.push(el);
  }
  GROUPS.forEach(function (sel) {
    root.querySelectorAll(sel).forEach(function (el, i) { mark(el, i); });
  });
  SINGLES.forEach(function (sel) {
    root.querySelectorAll(sel).forEach(function (el, i) { mark(el, i); });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        var el = e.target;
        el.classList.add('lp-in');
        io.unobserve(el);
        /* Hand the element back to its own hover styles once it has appeared. */
        var done = function (ev) {
          if (ev && ev.target !== el) return;
          el.removeEventListener('transitionend', done);
          el.removeAttribute('data-lp-reveal');
          el.classList.remove('lp-in');
          el.style.removeProperty('--lp-i');
        };
        el.addEventListener('transitionend', done);
        setTimeout(done, 1800);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  root.classList.add('lp-motion');
  targets.forEach(function (el) { io.observe(el); });

  /* Scroll progress bar + header shadow + hero orbit drift, one rAF per frame. */
  var bar = document.createElement('div');
  bar.className = 'lp-progress';
  bar.setAttribute('aria-hidden', 'true');
  root.insertBefore(bar, root.firstChild);
  var header = root.querySelector('.lp-header');
  var orbit = root.querySelector('.lp-orbit');
  var ticking = false;

  function frame() {
    ticking = false;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    bar.style.transform = 'scaleX(' + Math.min(1, y / max).toFixed(4) + ')';
    if (header) header.classList.toggle('lp-scrolled', y > 8);
    if (orbit && y < 900) orbit.style.transform = 'translateY(' + (y * 0.12).toFixed(1) + 'px) rotate(' + (y * 0.05).toFixed(1) + 'deg)';
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(frame); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();
})();
