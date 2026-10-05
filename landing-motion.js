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

/* Assembling logo shapes: copies of the logo's own facets drift in the margins
   and fly together into the mark as each one scrolls into view. */
(function () {
  'use strict';
  var root = document.getElementById('landingPage');
  if (!root || !root.classList.contains('lp-motion')) return;

  var NS = 'http://www.w3.org/2000/svg';
  /* Facet polygons taken from assets/branding/polymath-learning-centre.png. */
  var PIECES = [
    { c: '#56c4d0', p: '522,338 866,513 902,736 556,562' },
    { c: '#2e9ca6', p: '522,338 647,213 990,387 866,513' },
    { c: '#ec008c', p: '866,513 990,387 1142,240 1175,467 902,736' },
    { c: '#b51f6b', p: '836,308 984,160 1142,240 990,387' },
    { c: '#2e9ca6', p: '556,562 728,650 680,697 591,785' },
    { c: '#056c76', p: '556,562 728,650 680,697' },
    { c: '#b51f6b', p: '1175,467 1212,687 1100,630' },
    { c: '#8a1650', p: '1175,467 1100,630 1040,600' }
  ];
  var ORIGIN = { x: 522, y: 160, w: 690, h: 625 };

  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  var layer = document.createElement('div');
  layer.className = 'lp-shapes';
  layer.setAttribute('aria-hidden', 'true');
  root.insertBefore(layer, root.firstChild);

  var narrow = window.innerWidth < 760;
  var clusters = [];
  var docH = 3000, vw = window.innerWidth, vh = window.innerHeight;

  function build(n) {
    layer.textContent = '';
    clusters = [];
    seed = 7;
    for (var i = 0; i < n; i++) {
      var size = (narrow ? 70 : 110) + rnd() * (narrow ? 70 : 150);
      var whole = i % 3 === 0;
      var picks = whole ? PIECES.map(function (_, k) { return k; }) : [Math.floor(rnd() * PIECES.length), Math.floor(rnd() * PIECES.length)];
      var outline = !whole && rnd() < 0.35;
      var el = document.createElement('div');
      el.className = 'lp-shape';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', ORIGIN.x + ' ' + ORIGIN.y + ' ' + ORIGIN.w + ' ' + ORIGIN.h);
      svg.setAttribute('width', size);
      svg.setAttribute('height', size * ORIGIN.h / ORIGIN.w);
      var polys = picks.map(function (k) {
        var poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', PIECES[k].p);
        if (outline) {
          poly.setAttribute('fill', 'none');
          poly.setAttribute('stroke', PIECES[k].c);
          poly.setAttribute('stroke-width', '10');
          poly.setAttribute('stroke-linejoin', 'round');
        } else {
          poly.setAttribute('fill', PIECES[k].c);
        }
        svg.appendChild(poly);
        var a = rnd() * Math.PI * 2, d = 220 + rnd() * 420;
        return { el: poly, sx: Math.cos(a) * d, sy: Math.sin(a) * d, sr: (rnd() - 0.5) * 140 };
      });
      el.appendChild(svg);
      layer.appendChild(el);
      var left = i % 2 === 0;
      clusters.push({
        el: el, polys: polys, size: size,
        x: left ? -0.04 + rnd() * 0.05 : 0.97 - rnd() * 0.05 - size / vw,
        side: left ? -1 : 1,
        y: 220 + i * ((docH - 500) / n) + rnd() * 120,
        k: 0.6 + rnd() * 0.4,
        rot: (rnd() - 0.5) * 50,
        spin: (rnd() - 0.5) * 0.03,
        alpha: whole ? 0.34 : 0.2
      });
    }
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  var ticking = false;
  function draw() {
    ticking = false;
    var y = window.pageYOffset || 0;
    for (var i = 0; i < clusters.length; i++) {
      var c = clusters[i];
      var sy = c.y - y * c.k;
      if (sy < -c.size * 1.5 || sy > vh + c.size) { c.el.style.opacity = 0; continue; }
      var e = ease(clamp01((vh * 0.95 - sy) / (vh * 0.5)));
      var out = clamp01(sy / (vh * 0.2));
      var sc = 0.45 + 0.55 * e;
      c.el.style.opacity = (c.alpha * e * out).toFixed(3);
      c.el.style.transform = 'translate3d(' + (c.x * vw + c.side * (1 - e) * 60).toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) rotate(' + (c.rot * (1 - e) + y * c.spin).toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ')';
      for (var j = 0; j < c.polys.length; j++) {
        var p = c.polys[j], f = 1 - e;
        p.el.setAttribute('transform', 'translate(' + (p.sx * f).toFixed(1) + ' ' + (p.sy * f).toFixed(1) + ') rotate(' + (p.sr * f).toFixed(1) + ' 867 472)');
      }
    }
  }
  function req() { if (!ticking) { ticking = true; window.requestAnimationFrame(draw); } }

  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    var h = root.scrollHeight;
    if (h < 600) return;
    var nowNarrow = vw < 760;
    if (Math.abs(h - docH) > 60 || nowNarrow !== narrow || !clusters.length) {
      docH = h; narrow = nowNarrow;
      build(narrow ? 8 : 14);
    }
    req();
  }

  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root);
  measure();
})();
