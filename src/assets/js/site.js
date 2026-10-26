(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // theme
  var tt = $('[data-theme-toggle]');
  if (tt) tt.addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; try { localStorage.setItem('wls-theme', next); } catch (e) {}
  });
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!localStorage.getItem('wls-theme')) document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    });
  } catch (e) {}

  // mobile menu
  var mb = $('[data-menu-toggle]'), nav = $('#site-nav');
  if (mb && nav) mb.addEventListener('click', function () { var o = nav.classList.toggle('is-open'); mb.setAttribute('aria-expanded', o); });

  // copy link / print
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-copy'), done = function () { var t = b.innerHTML; b.textContent = 'Copied'; setTimeout(function () { b.innerHTML = t; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done); else { var i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); done(); }
    });
  });
  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });


  // Private notes: saved only in this browser (localStorage), never sent anywhere.
  var boxes = $$('.wls-notes textarea');
  if (boxes.length) {
    var P = 'wls-note:' + location.pathname + ':', store = null;
    try { store = window.localStorage; store.getItem('x'); } catch (e) { store = null; }
    var grow = function (t) { t.style.height = 'auto'; t.style.height = Math.max(96, t.scrollHeight + 4) + 'px'; };
    boxes.forEach(function (t) {
      var key = P + t.parentNode.getAttribute('data-note'), timer;
      if (store) { try { var v = store.getItem(key); if (v) t.value = v; } catch (e) {} }
      grow(t);
      t.addEventListener('input', function () { grow(t); if (!store) return; clearTimeout(timer); timer = setTimeout(function () { try { t.value ? store.setItem(key, t.value) : store.removeItem(key); } catch (e) {} }, 300); });
    });
    var bar = $('[data-notes-bar]'); if (bar) bar.classList.add('has-notes');
    $$('[data-clear-notes]').forEach(function (b) { b.addEventListener('click', function () {
      if (!confirm('Clear everything you have written in the note boxes on this page?')) return;
      boxes.forEach(function (t) { t.value = ''; grow(t); try { store && store.removeItem(P + t.parentNode.getAttribute('data-note')); } catch (e) {} });
    }); });
  }
  // Printing: show the reader\'s own words on the ruled lines, and always print in light colours.
  var prevTheme = null;
  window.addEventListener('beforeprint', function () {
    prevTheme = document.documentElement.dataset.theme; document.documentElement.dataset.theme = 'light';
    $$('.wls-notes').forEach(function (n) { var t = $('textarea', n), l = $('.wls-lines', n); if (t && l) l.textContent = t.value; });
  });
  window.addEventListener('afterprint', function () { if (prevTheme) document.documentElement.dataset.theme = prevTheme; $$('.wls-lines').forEach(function (l) { l.textContent = ''; }); });

  // video: load YouTube only when asked
  $$('[data-youtube]').forEach(function (v) {
    var link = $('.video__play', v); if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault(); var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.getAttribute('data-youtube') + '?autoplay=1&rel=0';
      f.title = v.getAttribute('data-title') || 'Video'; f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
      v.innerHTML = ''; v.appendChild(f);
    });
  });

  // read page filters
  var fl = $('[data-filters]');
  if (fl) fl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]'); if (!b) return; var f = b.getAttribute('data-filter');
    $$('[data-filter]', fl).forEach(function (x) { x.classList.toggle('is-on', x === b); });
    $$('[data-filter-list] .wls-card').forEach(function (c) { c.parentNode === c.parentNode; c.style.display = (f === 'all' || c.getAttribute('data-type') === f) ? '' : 'none'; });
  });

  // counters count up once
  var cs = $$('[data-count]');
  if (cs.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; io.unobserve(en.target);
        var el = en.target, to = +el.getAttribute('data-count') || 0, t0 = performance.now(), d = 900;
        (function step(t) { var k = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en'); if (k < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 0.4 });
    cs.forEach(function (el) { el.textContent = '0'; io.observe(el); });
  } else cs.forEach(function (el) { el.textContent = (+el.getAttribute('data-count') || 0).toLocaleString('en'); });
})();
