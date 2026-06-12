/* ÆTHER — enhance.js  (added 2026-06-12)
   Progressive, accessibility-first behaviour for:
   • a decorative living background
   • a reading-progress indicator
   • a sticky, condensing header
   • scroll-reveal animations

   Guarantees:
   - Runs only as enhancement. If this script never executes, the page is
     fully readable (CSS hides content only under html.js + allowed motion).
   - Honours prefers-reduced-motion (no reveal animation, static background).
   - A failsafe reveals all content shortly after load so nothing can stay
     hidden if an observer misfires.
*/
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var body = document.body;
    if (!body) return;

    /* ── Decorative living background ── */
    var aurora = document.createElement('div');
    aurora.className = 'aurora';
    aurora.setAttribute('aria-hidden', 'true');
    body.appendChild(aurora);

    /* ── Reading-progress indicator (decorative) ── */
    var bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    body.appendChild(bar);

    var header = document.querySelector('header');
    var ticking = false;

    function update() {
      var st = window.pageYOffset || docEl.scrollTop || 0;
      var scrollable = docEl.scrollHeight - docEl.clientHeight;
      var pct = scrollable > 0 ? (st / scrollable) * 100 : 0;
      bar.style.width = pct + '%';
      if (header) {
        if (st > 40) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      }
      ticking = false;
    }
    function onScrollOrResize() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    update();

    /* ── Scroll reveal ── */
    var main = document.querySelector('main');
    if (!main) return;

    var targets = [].slice.call(
      main.querySelectorAll(
        ':scope > *:not(.logo-wrapper):not(.sections), :scope > .sections > *'
      )
    );
    if (!targets.length) return;

    function revealAll() {
      for (var i = 0; i < targets.length; i++) {
        targets[i].classList.add('in-view');
      }
    }

    /* Reduced motion or no IntersectionObserver: just show everything. */
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('in-view');
          obs.unobserve(entries[i].target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    for (var j = 0; j < targets.length; j++) io.observe(targets[j]);

    /* Failsafe: never leave content hidden. */
    setTimeout(revealAll, 2500);
  });
})();
