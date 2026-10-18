import {
  state, TYPES, RESETS, MAX_TASKS, loadState, addTask, removeTask, restoreTask, setDone,
  clearTicks, restoreTicks, setGroupDone, periodStart, nextReset, isDone, escapeHtml, escapeAttr,
  exportState, importState, LOCKED_TASKS, STANDALONE_REQUIRED_TASKS
} from './core.js';
import { initChrome, toast, announce, ui, saveUi, closeSettings } from './shell.js';

const SECTIONS = {
  daily: { title: 'Daily', empty: 'No daily tasks yet.', placeholder: 'Add an extra daily mission…' },
  content: { title: 'Content', empty: 'No content tasks yet.', placeholder: 'Add a content task…' },
  once: { title: 'One-time', empty: 'No one-time tasks yet. These never reset.', placeholder: 'Add a one-time task…' }
};
const ADD_MESSAGES = {
  empty: 'Type a task name first.',
  dup: 'That task is already in this list.',
  full: `The checklist is full (${MAX_TASKS} tasks). Remove one first.`
};
const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

const collapsed = new Set();
let periodKey = '';
let timer = 0;

const pad = n => String(n).padStart(2, '0');

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function resetNote(type, now) {
  const r = RESETS[type];
  const local = new Date(nextReset(type, now)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${pad(r.hour)}:${pad(r.minute)} UTC · ${local} your time`;
}

function currentKey(now) {
  return periodStart('daily', now) + '|' + periodStart('content', now);
}

function taskHtml(task, now, sub) {
  const done = isDone(task, now);
  const action = task.locked
    ? `<span class="lock" role="img" aria-label="Required task, can't be removed" title="Required, can't be removed">${LOCK}</span>`
    : `<button class="rm" type="button" data-remove="${task.id}" aria-label="Remove ${escapeAttr(task.name)}">&times;</button>`;
  return `
      <div class="trophy-item${sub ? ' sub' : ''}${done ? ' checked' : ''}">
        <input type="checkbox" data-id="${task.id}" aria-label="${escapeAttr(task.name)}" ${done ? 'checked' : ''}>
        <span>${escapeHtml(task.name)}</span>
        ${action}
      </div>`;
}

function missionHtml(tasks, now) {
  const done = tasks.filter(t => isDone(t, now)).length;
  const all = tasks.length > 0 && done === tasks.length;
  return `
      <div class="mission">
        <div class="trophy-item mission-main${all ? ' checked' : ''}">
          <input type="checkbox" id="grp-daily" data-group="daily" aria-label="Complete Daily Missions" ${all ? 'checked' : ''}>
          <span>Complete Daily Missions</span>
          <span class="mission-count" id="gcount-daily">${done}/${tasks.length}</span>
        </div>
        <div class="mission-subs">${tasks.map(t => taskHtml(t, now, true)).join('')}
        </div>
      </div>`;
}

function statsFor(type, now) {
  const tasks = state.tasks.filter(t => t.type === type);
  const done = tasks.filter(t => isDone(t, now)).length;
  return { tasks, done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

function sectionHtml(type, now) {
  const info = SECTIONS[type];
  const allTasks = state.tasks.filter(t => t.type === type);
  const { done, total, pct } = statsFor(type, now);
  const isCollapsed = collapsed.has(type);
  const desc = type === 'once'
    ? 'Never resets. Untick or remove tasks yourself.'
    : `Resets in <strong id="cd-${type}">${formatDuration(nextReset(type, now) - now)}</strong> <span class="desc-note">(${escapeHtml(resetNote(type, now))})</span>`;
  let list;
  if (type === 'daily') {
    const missionIds = new Set(LOCKED_TASKS.map(([id]) => id));
    const missionTasks = allTasks.filter(t => missionIds.has(t.id));
    const otherTasks = allTasks.filter(t => !missionIds.has(t.id));
    list = missionHtml(missionTasks, now) + otherTasks.map(t => taskHtml(t, now, false)).join('');
  } else {
    list = total
      ? allTasks.map(t => taskHtml(t, now, false)).join('')
      : `<div class="empty-line">${info.empty}</div>`;
  }
  return `
  <section class="block">
    <div class="block-head">
      <h2>${info.title} <span class="section-count" id="count-${type}">${done}/${total}</span>
        <button class="block-collapse-btn" type="button" data-collapse="${type}" aria-label="${isCollapsed ? 'Expand' : 'Collapse'} ${info.title}" aria-expanded="${isCollapsed ? 'false' : 'true'}" aria-controls="body-${type}">
          <span class="cal-trainee-arrow${isCollapsed ? '' : ' open'}" aria-hidden="true">${CHEVRON}</span>
        </button>
      </h2>
      <span class="desc">${desc}</span>
    </div>
    <div class="block-body" id="body-${type}"${isCollapsed ? ' hidden' : ''}>
      <div class="mycard">
        <div class="trophy-top">
          <span class="label">Progress</span>
          <div class="progress-track" role="progressbar" aria-label="${info.title} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" id="bar-${type}"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-pct" id="pct-${type}">${done}/${total} · ${pct}%</span>
        </div>
        <div class="trophy-list">${list}
        </div>
        <form class="add-trophy" data-add="${type}" autocomplete="off">
          <input type="text" id="add-${type}" maxlength="80" placeholder="${info.placeholder}" aria-label="${info.placeholder.replace('…', '')}">
          <button class="btn small" type="submit">+ Add</button>
        </form>
      </div>
    </div>
  </section>`;
}

function render(focusId) {
  const now = Date.now();
  periodKey = currentKey(now);
  document.getElementById('sections').innerHTML = TYPES.map(type => sectionHtml(type, now)).join('');
  syncSection('daily');
  if (focusId) document.getElementById(focusId)?.focus();
}

function updateProgress(type) {
  const { done, total, pct } = statsFor(type, Date.now());
  const count = document.getElementById(`count-${type}`);
  const label = document.getElementById(`pct-${type}`);
  const bar = document.getElementById(`bar-${type}`);
  if (count) count.textContent = `${done}/${total}`;
  if (label) label.textContent = `${done}/${total} · ${pct}%`;
  if (bar) {
    bar.setAttribute('aria-valuenow', String(pct));
    const fill = bar.querySelector('.progress-fill');
    if (fill) fill.style.width = pct + '%';
  }
}

function syncSection(type) {
  const body = document.getElementById(`body-${type}`);
  if (!body) return;
  const now = Date.now();
  state.tasks.filter(t => t.type === type).forEach(t => {
    const cb = body.querySelector(`input[data-id="${t.id}"]`);
    if (!cb) return;
    const done = isDone(t, now);
    cb.checked = done;
    cb.closest('.trophy-item')?.classList.toggle('checked', done);
  });
  if (type === 'daily') {
    const missionIds = new Set(LOCKED_TASKS.map(([id]) => id));
    const missionTasks = state.tasks.filter(t => t.type === 'daily' && missionIds.has(t.id));
    const missionDone = missionTasks.filter(t => isDone(t, now)).length;
    const missionTotal = missionTasks.length;
    const grp = document.getElementById('grp-daily');
    if (grp) {
      grp.checked = missionTotal > 0 && missionDone === missionTotal;
      grp.indeterminate = missionDone > 0 && missionDone < missionTotal;
      grp.closest('.trophy-item')?.classList.toggle('checked', grp.checked);
    }
    const gc = document.getElementById('gcount-daily');
    if (gc) gc.textContent = `${missionDone}/${missionTotal}`;
  }
  updateProgress(type);
}

function tick() {
  const now = Date.now();
  if (currentKey(now) !== periodKey) {
    const active = document.activeElement;
    const keep = active && active.id && document.getElementById('sections').contains(active) ? active.id : '';
    render(keep);
    announce('A reset just happened. Your daily or content tasks were unticked.');
    return;
  }
  for (const type of ['daily', 'content']) {
    const el = document.getElementById(`cd-${type}`);
    if (el) el.textContent = formatDuration(nextReset(type, now) - now);
  }
}

function startTimer() {
  if (timer || document.hidden) return;
  tick();
  timer = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = 0;
}

function wireSections() {
  const host = document.getElementById('sections');

  host.addEventListener('change', (e) => {
    const group = e.target.closest('input[data-group]');
    if (group) {
      setGroupDone(group.dataset.group, group.checked);
      syncSection(group.dataset.group);
      return;
    }
    const cb = e.target.closest('input[type="checkbox"][data-id]');
    if (!cb) return;
    const linked = setDone(cb.dataset.id, cb.checked);
    if (!linked) { render(); return; }
    const task = state.tasks.find(t => t.id === cb.dataset.id);
    if (task) syncSection(task.type);
    if (linked.length) announce(`Also ${cb.checked ? 'ticked' : 'unticked'} ${linked.map(t => t.name).join(' and ')}.`);
  });

  host.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-collapse]');
    if (toggle) {
      const type = toggle.dataset.collapse;
      const open = collapsed.has(type);
      if (open) collapsed.delete(type); else collapsed.add(type);
      ui.collapsed = Array.from(collapsed);
      saveUi();
      const body = document.getElementById(`body-${type}`);
      if (body) body.hidden = !open;
      const info = SECTIONS[type];
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', `${open ? 'Collapse' : 'Expand'} ${info.title}`);
      toggle.querySelector('.cal-trainee-arrow')?.classList.toggle('open', open);
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (!rm) return;
    const res = removeTask(rm.dataset.remove);
    if (!res) return;
    render(`add-${res.task.type}`);
    toast(`Removed ${res.task.name}`, {
      actionLabel: 'Undo',
      duration: 8000,
      onAction: () => {
        if (restoreTask(res.task, res.index)) render();
        else toast("Couldn't undo — that task already exists.", { kind: 'error' });
      }
    });
  });

  host.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-add]');
    if (!form) return;
    e.preventDefault();
    const type = form.dataset.add;
    const input = form.querySelector('input');
    const result = addTask(type, input.value);
    if (result === 'ok') { render(`add-${type}`); return; }
    toast(ADD_MESSAGES[result] || "Couldn't add that task.");
    input.focus();
  });
}

function wireUntickAll() {
  const btn = document.getElementById('untick-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const snapshot = clearTicks();
    render();
    toast(snapshot.size ? 'Unticked every task.' : 'Nothing was ticked.', snapshot.size ? {
      actionLabel: 'Undo',
      duration: 8000,
      onAction: () => { restoreTicks(snapshot); render(); }
    } : {});
  });
}

function wireBackup() {
  const btn = document.getElementById('backup-btn');
  const overlay = document.getElementById('backup-overlay');
  const closeBtn = document.getElementById('backup-close');
  const exportText = document.getElementById('backup-export-text');
  const exportStamp = document.getElementById('backup-export-stamp');
  const copyBtn = document.getElementById('backup-copy-btn');
  const exportFileBtn = document.getElementById('backup-export-file-btn');
  const importText = document.getElementById('backup-import-text');
  const importError = document.getElementById('backup-import-error');
  const importTextBtn = document.getElementById('backup-import-text-btn');
  const importFileInput = document.getElementById('backup-import-file');

  if (!btn || !overlay) return;

  function setImportError(message) {
    if (importText) {
      if (message) importText.setAttribute('aria-invalid', 'true');
      else importText.removeAttribute('aria-invalid');
    }
    if (!importError) return;
    if (message) {
      importError.textContent = message;
      importError.hidden = false;
    } else {
      importError.textContent = '';
      importError.hidden = true;
    }
  }

  function openBackup() {
    closeSettings();
    overlay.classList.add('show');
    if (closeBtn) closeBtn.focus();
    refreshBackupExport();
  }

  function closeBackup() {
    overlay.classList.remove('show');
    setImportError('');
  }

  function refreshBackupExport() {
    if (exportText) exportText.value = exportState();
    if (exportStamp) {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      exportStamp.textContent = `Generated ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} · ${state.tasks.length} tasks`;
    }
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openBackup();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeBackup);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeBackup(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (overlay.classList.contains('show')) {
      e.stopPropagation();
      closeBackup();
      if (btn) btn.focus();
    }
  });

  if (copyBtn) copyBtn.addEventListener('click', async () => {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText.value);
      toast('Backup JSON copied to clipboard.');
    } catch (_) {
      exportText.select();
      try {
        document.execCommand('copy');
        toast('Backup JSON copied to clipboard.');
      } catch (__) {
        toast('Copy failed — select the text manually.', { kind: 'error' });
      }
    }
  });

  if (exportFileBtn) exportFileBtn.addEventListener('click', () => {
    if (!exportText) return;
    const blob = new Blob([exportText.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const name = `Checklist-${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Exported ${state.tasks.length} tasks.`);
  });

  if (importTextBtn) importTextBtn.addEventListener('click', () => {
    if (!importText) return;
    const text = importText.value.trim();
    if (!text) { toast('Paste an export first, then import.'); importText.focus(); return; }
    const res = importState(text);
    if (res) {
      importText.value = '';
      setImportError('');
      render();
      toast(`Imported ${res.added} task${res.added === 1 ? '' : 's'} (${res.total} total).`);
    } else {
      setImportError("Couldn't read that — expected a Checklist export. Nothing was changed.");
    }
  });

  if (importText) importText.addEventListener('input', () => setImportError(''));

  if (importFileInput) importFileInput.addEventListener('change', e => {
    if (e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        const res = importState(reader.result);
        if (res) {
          importFileInput.value = '';
          setImportError('');
          render();
          toast(`Imported ${res.added} task${res.added === 1 ? '' : 's'} (${res.total} total).`);
        } else {
          setImportError("Couldn't read that file — expected a Checklist export. Nothing was changed.");
        }
      };
      reader.readAsText(e.target.files[0]);
    }
    e.target.value = '';
  });
}

function init() {
  initChrome();
  loadState();
  ui.collapsed.forEach(type => collapsed.add(type));
  render();
  wireSections();
  wireUntickAll();
  wireBackup();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer(); else startTimer();
  });
  startTimer();
}

init();