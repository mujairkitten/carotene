(function () {
  'use strict';

  var LS_KEY = 'carotene-hub-theme';
  var TR_KEY = 'mylist';

  function readTheme() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var t = JSON.parse(raw);
        return { light: !!t.light, dirt: !!t.dirt };
      }
    } catch (e) {}
    try {
      var snap = JSON.parse(localStorage.getItem(TR_KEY) || 'null');
      var tr = snap && snap.settings;
      if (tr && typeof tr.lightMode === 'boolean') {
        return { light: tr.lightMode, dirt: tr.colorTheme === 'dirt' };
      }
    } catch (e2) {}
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    return { light: !!(mq && mq.matches), dirt: false };
  }

  function saveTheme(t) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(t)); } catch (e) {}
  }

  var SVG_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19"/></svg>';
  var SVG_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2Z"/></svg>';
  var SVG_THEME = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="8.2" height="14" rx="2" fill="#22b573"/><rect x="12.3" y="5" width="8.2" height="14" rx="2" fill="#e0a640"/></svg>';

  function makeToggle(id, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = 'dock-btn';
    b.setAttribute('aria-label', label);
    return b;
  }

  var theme = readTheme();

  var nav = document.querySelector('.dock-nav');
  var modeBtn = makeToggle('hub-mode-btn', 'Toggle light/dark mode');
  var themeBtn = makeToggle('hub-theme-btn', 'Toggle Turf/Dirt color theme');
  themeBtn.innerHTML = SVG_THEME;
  if (nav) {
    nav.appendChild(modeBtn);
    nav.appendChild(themeBtn);
  }

  function syncThemeButtons(t) {
    modeBtn.innerHTML = t.light ? SVG_MOON : SVG_SUN;
    modeBtn.setAttribute('aria-pressed', t.light ? 'true' : 'false');
    themeBtn.setAttribute('aria-pressed', t.dirt ? 'true' : 'false');
  }

  function applyTheme(t) {
    document.body.classList.toggle('light', t.light);
    document.body.classList.toggle('dirt', t.dirt);
    syncThemeButtons(t);
  }

  modeBtn.addEventListener('click', function () {
    theme.light = !theme.light;
    saveTheme(theme);
    applyTheme(theme);
  });
  themeBtn.addEventListener('click', function () {
    theme.dirt = !theme.dirt;
    saveTheme(theme);
    applyTheme(theme);
  });

  applyTheme(theme);

  function spawnCleats() {
    var field = document.getElementById('cleat-field');
    if (!field) return;
    var colors = ['#4ee38a', '#5b8cff', '#ffa552'];
    var sizes = [16, 20, 26, 32, 40, 48, 56];
    var count = 40;
    var frag = document.createDocumentFragment();

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pct(v) { return v.toFixed(1) + '%'; }

    for (var i = 0; i < count; i++) {
      var size = sizes[Math.floor(Math.random() * sizes.length)];
      var x0 = rand(-12, 40), y0 = rand(65, 112);
      var x1 = rand(60, 112), y1 = rand(-12, 35);
      var dur = rand(40, 72);
      var el = document.createElement('div');
      el.className = 'cl';
      var s = el.style;
      s.setProperty('--x0', pct(x0));
      s.setProperty('--y0', pct(y0));
      s.setProperty('--x1', pct(x1));
      s.setProperty('--y1', pct(y1));
      s.setProperty('--xm', pct((x0 + x1) / 2 + rand(-25, 25)));
      s.setProperty('--ym', pct((y0 + y1) / 2 + rand(-25, 25)));
      s.setProperty('--d', dur.toFixed(1) + 's');
      s.setProperty('--dl', (-rand(0, dur)).toFixed(1) + 's');
      s.setProperty('--rd', (-rand(0, 18)).toFixed(1) + 's');
      s.setProperty('--o', rand(0.16, 0.28).toFixed(2));
      s.setProperty('--ease', 'cubic-bezier(' + rand(0.1, 0.35).toFixed(2) + ',' + rand(0.55, 0.85).toFixed(2) + ',' + rand(0.4, 0.6).toFixed(2) + ',1)');
      el.innerHTML = '<svg viewBox="-22 -18 44 44" width="' + size + '" height="' + size + '" fill="none" aria-hidden="true" focusable="false"><path d="M-13,14 L-11,-3 A11,11 0 0 1 11,-3 L13,14" stroke="' + colors[i % 3] + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      frag.appendChild(el);
    }
    field.appendChild(frag);
  }

  spawnCleats();

  var about = document.getElementById('about');
  var aboutClose = document.getElementById('about-close');
  var aboutLink = document.querySelector('.dock-about');
  var opener = null;

  function setPageInert(on) {
    var tools = document.getElementById('tools');
    var brand = document.querySelector('.brand');
    var dock = document.querySelector('.dock');
    var skip = document.querySelector('.skip-link');
    if (tools) tools.inert = on;
    if (brand) brand.inert = on;
    if (dock) dock.inert = on;
    if (skip) skip.inert = on;
  }

  function focusables() {
    return Array.prototype.filter.call(
      about.querySelectorAll('a[href], button:not([disabled])'),
      function (el) { return el.getClientRects().length > 0; }
    );
  }

  function openAbout() {
    if (about.classList.contains('show')) return;
    opener = document.activeElement;
    about.classList.add('show');
    document.body.classList.add('modal-open');
    setPageInert(true);
    aboutClose.focus();
  }

  function closeAbout() {
    if (!about.classList.contains('show')) return;
    about.classList.remove('show');
    document.body.classList.remove('modal-open');
    setPageInert(false);
    var target = (opener && opener !== document.body && opener.isConnected &&
      !opener.closest('[inert]')) ? opener : aboutLink;
    if (target) target.focus();
  }

  if (aboutLink) {
    aboutLink.addEventListener('click', function (e) {
      e.preventDefault();
      openAbout();
    });
  }
  if (aboutClose) aboutClose.addEventListener('click', closeAbout);
  about.addEventListener('click', function (e) {
    if (e.target === about) closeAbout();
  });

  document.addEventListener('keydown', function (e) {
    if (!about.classList.contains('show')) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeAbout();
      return;
    }
    if (e.key === 'Tab') {
      var f = focusables();
      if (f.length === 0) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  if (window.location.hash === '#about') {
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    openAbout();
  }
})();
