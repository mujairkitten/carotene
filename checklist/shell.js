const THEME_KEY = 'carotene-hub-theme';
const TR_KEY = 'mylist';
const UI_KEY = 'checklist-ui';
const POS_DESKTOP = ['left', 'bottom', 'right', 'top'];
const POS_MOBILE = ['top', 'bottom'];

const theme = { light: false, dirt: false };
const ui = { desktop: 'right', mobile: 'bottom' };

function readTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) {
      const t = JSON.parse(raw);
      return { light: !!t.light, dirt: !!t.dirt };
    }
  } catch (e) {}
  try {
    const snap = JSON.parse(localStorage.getItem(TR_KEY) || 'null');
    const tr = snap && snap.settings;
    if (tr && typeof tr.lightMode === 'boolean') {
      return { light: tr.lightMode, dirt: tr.colorTheme === 'dirt' };
    }
  } catch (e) {}
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  return { light: !!(mq && mq.matches), dirt: false };
}

function readUi() {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
    if (raw && POS_DESKTOP.includes(raw.desktop)) ui.desktop = raw.desktop;
    if (raw && POS_MOBILE.includes(raw.mobile)) ui.mobile = raw.mobile;
  } catch (e) {}
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

const isDesktop = () => window.matchMedia('(min-width: 960px)').matches;
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const byId = (id) => document.getElementById(id);

export function announce(message) {
  let el = byId('sr-announcer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sr-announcer';
    el.className = 'sr-only';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

const MAX_TOASTS = 3;
let errorToast = null;

export function toast(message, opts = {}) {
  let region = byId('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  const { actionLabel, onAction, kind = 'info', duration = 5000 } = opts;
  if (kind === 'error' && errorToast && errorToast.isConnected) {
    errorToast.querySelector('span').textContent = message;
    return errorToast;
  }
  while (region.children.length >= MAX_TOASTS) region.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  const dismiss = () => {
    clearTimeout(el._timer);
    el.remove();
    if (errorToast === el) errorToast = null;
  };
  if (actionLabel && typeof onAction === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { onAction(); dismiss(); });
    el.appendChild(btn);
  }
  if (kind === 'error') {
    el.style.borderColor = 'var(--f)';
    el.setAttribute('role', 'alert');
    errorToast = el;
  }
  region.appendChild(el);
  if (duration > 0) {
    const wait = () => {
      if (el.contains(document.activeElement)) { el._timer = setTimeout(wait, 1000); return; }
      dismiss();
    };
    el._timer = setTimeout(wait, duration);
  }
  return el;
}

function syncTopbarHeight() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const vertical = document.body.classList.contains('nav-left') || document.body.classList.contains('nav-right');
  const target = (vertical ? topbar.querySelector('.topbar-actions') : null) || topbar;
  document.documentElement.style.setProperty('--topbar-h', `${target.getBoundingClientRect().height}px`);
}

function activePosition() {
  return isDesktop() ? ui.desktop : ui.mobile;
}

function applyNavPosition() {
  const pos = activePosition();
  document.body.classList.remove('nav-left', 'nav-bottom', 'nav-right', 'nav-top');
  document.body.classList.add(`nav-${pos}`);
  const desktop = isDesktop();
  document.querySelectorAll('.nav-pos-btn').forEach(btn => {
    const p = btn.dataset.pos;
    btn.disabled = !desktop && (p === 'left' || p === 'right');
    const on = p === pos;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function applyTheme() {
  document.body.classList.toggle('light', theme.light);
  document.body.classList.toggle('dirt', theme.dirt);
  const mode = byId('mode-toggle-btn');
  const color = byId('theme-toggle-btn');
  if (mode) mode.setAttribute('aria-pressed', theme.light ? 'true' : 'false');
  if (color) color.setAttribute('aria-pressed', theme.dirt ? 'true' : 'false');
}

let tooltipEl = null;
let tooltipTarget = null;

function showTooltip(target, text) {
  tooltipEl = tooltipEl || byId('tooltip');
  if (!tooltipEl) return;
  tooltipEl.innerHTML = '';
  const div = document.createElement('div');
  div.textContent = text;
  tooltipEl.appendChild(div);
  tooltipEl.style.width = 'auto';
  tooltipEl.style.maxWidth = '200px';
  tooltipTarget = target;
  positionTooltip();
}

function positionTooltip() {
  if (!tooltipEl || !tooltipTarget) return;
  const rect = tooltipTarget.getBoundingClientRect();
  const tip = tooltipEl.getBoundingClientRect();
  const gap = 8;
  const left = Math.max(gap, Math.min(rect.left, window.innerWidth - tip.width - 16));
  let top = rect.top - tip.height - gap;
  if (top < gap) top = rect.bottom + gap;
  top = Math.max(gap, Math.min(top, window.innerHeight - tip.height - gap));
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
  tooltipEl.classList.add('show');
  tooltipEl.setAttribute('aria-hidden', 'false');
}

function hideTooltip() {
  tooltipTarget = null;
  if (!tooltipEl) return;
  tooltipEl.classList.remove('show');
  tooltipEl.setAttribute('aria-hidden', 'true');
}

function wireTooltips() {
  const find = (e) => e.target.closest ? e.target.closest('[data-tooltip]') : null;
  document.addEventListener('mouseover', (e) => {
    const el = find(e);
    if (el && !el.contains(e.relatedTarget)) showTooltip(el, el.dataset.tooltip);
  });
  document.addEventListener('mouseout', (e) => {
    const el = find(e);
    if (el && !el.contains(e.relatedTarget)) hideTooltip();
  });
  document.addEventListener('focusin', (e) => {
    const el = find(e);
    if (el) showTooltip(el, el.dataset.tooltip);
  });
  document.addEventListener('focusout', (e) => { if (find(e)) hideTooltip(); });
  document.addEventListener('scroll', positionTooltip, true);
  window.addEventListener('resize', positionTooltip);
}

function setPanel(panel, btn, open) {
  if (!panel) return;
  panel.classList.toggle('show', open);
  panel.inert = !open;
  if (open) panel.removeAttribute('aria-hidden');
  else panel.setAttribute('aria-hidden', 'true');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeSettings() { setPanel(byId('settings-panel'), byId('settings-btn'), false); }

function closeCarotene() {
  const panel = byId('carotene-panel');
  const btn = byId('carotene-btn');
  if (!panel || !panel.classList.contains('open')) return false;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  return true;
}

function wireAbout() {
  const overlay = byId('about-overlay');
  const closeBtn = byId('about-close');
  const openBtn = byId('about-btn');
  if (!overlay || !openBtn) return;
  let opener = null;
  const setInert = (on) => {
    document.querySelectorAll('.wrap, .topbar').forEach(el => { el.inert = on; });
  };
  const items = () => [...overlay.querySelectorAll('a[href], button:not([disabled])')]
    .filter(el => el.getClientRects().length > 0);
  const open = () => {
    if (overlay.classList.contains('show')) return;
    opener = document.activeElement;
    closeSettings();
    overlay.classList.add('show');
    setInert(true);
    if (closeBtn) closeBtn.focus();
  };
  const close = () => {
    if (!overlay.classList.contains('show')) return;
    overlay.classList.remove('show');
    setInert(false);
    const target = opener && opener.isConnected && !opener.closest('[inert]') ? opener : byId('settings-btn');
    if (target) target.focus();
  };
  openBtn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const list = items();
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

function updateJumpButtons() {
  const top = byId('jump-top-btn');
  const bottom = byId('jump-bottom-btn');
  const y = window.scrollY || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (top) top.disabled = y <= 4;
  if (bottom) bottom.disabled = y >= max - 4;
}

function wireJump() {
  const behavior = () => (reducedMotion() ? 'auto' : 'smooth');
  const top = byId('jump-top-btn');
  const bottom = byId('jump-bottom-btn');
  if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: behavior() }));
  if (bottom) bottom.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: behavior() }));
  let raf = 0;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; updateJumpButtons(); });
  }, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(updateJumpButtons).observe(document.body);
  updateJumpButtons();
}

export function initChrome() {
  Object.assign(theme, readTheme());
  readUi();
  applyTheme();
  applyNavPosition();
  syncTopbarHeight();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncTopbarHeight);

  const settingsBtn = byId('settings-btn');
  const settingsPanel = byId('settings-panel');
  const caroteneBtn = byId('carotene-btn');
  const caropanel = byId('carotene-panel');
  setPanel(settingsPanel, settingsBtn, false);

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCarotene();
      setPanel(settingsPanel, settingsBtn, !settingsPanel.classList.contains('show'));
    });
    settingsPanel.addEventListener('click', (e) => {
      e.stopPropagation();
      const nav = e.target.closest('.nav-pos-btn');
      if (nav && !nav.disabled) {
        if (isDesktop()) ui.desktop = nav.dataset.pos; else ui.mobile = nav.dataset.pos;
        save(UI_KEY, ui);
        applyNavPosition();
        syncTopbarHeight();
        announce(`Navbar ${nav.dataset.pos}.`);
      }
    });
    settingsPanel.addEventListener('focusout', (e) => {
      const next = e.relatedTarget;
      if (!next || !settingsPanel.classList.contains('show')) return;
      if (settingsPanel.contains(next) || settingsBtn.contains(next)) return;
      closeSettings();
    });
  }

  const modeBtn = byId('mode-toggle-btn');
  const themeBtn = byId('theme-toggle-btn');
  if (modeBtn) modeBtn.addEventListener('click', () => {
    theme.light = !theme.light;
    save(THEME_KEY, theme);
    applyTheme();
    announce(theme.light ? 'Light mode on.' : 'Dark mode on.');
  });
  if (themeBtn) themeBtn.addEventListener('click', () => {
    theme.dirt = !theme.dirt;
    save(THEME_KEY, theme);
    applyTheme();
    announce(theme.dirt ? 'Dirt theme.' : 'Turf theme.');
  });

  if (caroteneBtn && caropanel) {
    caroteneBtn.setAttribute('aria-expanded', 'false');
    caroteneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = caropanel.classList.toggle('open');
      caropanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      caroteneBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) closeSettings();
    });
  }

  document.addEventListener('click', (e) => {
    if (caropanel && caroteneBtn && !caropanel.contains(e.target) && !caroteneBtn.contains(e.target)) closeCarotene();
    closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const settingsOpen = settingsPanel && settingsPanel.classList.contains('show');
    const caroOpen = caropanel && caropanel.classList.contains('open');
    closeCarotene();
    closeSettings();
    if (settingsOpen && settingsBtn) settingsBtn.focus();
    else if (caroOpen && caroteneBtn) caroteneBtn.focus();
  });

  window.addEventListener('resize', () => {
    applyNavPosition();
    syncTopbarHeight();
    updateJumpButtons();
  });

  wireAbout();
  wireTooltips();
  wireJump();
}