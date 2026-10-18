import { toast } from './shell.js';

const STORAGE_KEY = 'checklist';
const MAX_NAME = 80;
const MAX_STORED = 256 * 1024;
const DAY = 86400000;
const SAFE_ID = /^[a-z0-9]{7}$/;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const LOCKED_TASKS = [
  ['dm00001', 'Win a race in Career Run'],
  ['dm00002', 'Complete a Career Run'],
  ['dm00003', 'Daily Race (once)'],
  ['dm00004', 'Daily Race (3 times)'],
  ['dm00005', 'Do Team Trials'],
  ['dm00006', 'Check the Club'],
  ['dm00007', 'Request the shoes in the Club']
];

const LINKS = {
  dm00004: 'dm00003',
  dm00007: 'dm00006',
  dl00003: 'dm00006'
};

export const STANDALONE_REQUIRED_TASKS = [
  ['dl00001', 'Do Daily Legend Race'],
  ['dl00002', 'Purchase something at Daily Shop'],
  ['dl00003', 'Donate shoes at the Club (10 times)']
];

export const TYPES = ['daily', 'content', 'once'];
export const RESETS = {
  daily: { hour: 15, minute: 0 },
  content: { hour: 22, minute: 0 }
};
export const MAX_TASKS = 100;

export const state = { tasks: [] };

let storageHealthy = true;
let saveTimer = 0;

export function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
}
export function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function uid() {
  let id = '';
  for (let i = 0; i < 7; i++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

export function cleanName(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME)
    : '';
}

function nameKey(type, name) {
  return type + '|' + name.toLocaleLowerCase();
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function normalizeTasks(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const usedIds = new Set();
  const usedNames = new Set();
  const out = [];
  for (const [id, name] of LOCKED_TASKS) {
    const stored = list.find(item => isPlainObject(item) && item.id === id);
    const doneAt = stored && Number.isFinite(stored.doneAt) && stored.doneAt >= 0 ? stored.doneAt : null;
    usedIds.add(id);
    usedNames.add(nameKey('daily', name.toLocaleLowerCase()));
    out.push({ id, type: 'daily', name, doneAt, locked: true });
  }
  for (const [id, name] of STANDALONE_REQUIRED_TASKS) {
    const stored = list.find(item => isPlainObject(item) && item.id === id);
    const doneAt = stored && Number.isFinite(stored.doneAt) && stored.doneAt >= 0 ? stored.doneAt : null;
    usedIds.add(id);
    usedNames.add(nameKey('daily', name.toLocaleLowerCase()));
    out.push({ id, type: 'daily', name, doneAt, locked: true });
  }
  for (const item of list.slice(0, MAX_TASKS)) {
    if (!isPlainObject(item) || !TYPES.includes(item.type)) continue;
    if (LOCKED_TASKS.some(([id]) => id === item.id)) continue;
    const name = cleanName(item.name);
    if (!name || out.length >= MAX_TASKS) continue;
    const key = nameKey(item.type, name.toLocaleLowerCase());
    if (usedNames.has(key)) continue;
    usedNames.add(key);
    let id = typeof item.id === 'string' && SAFE_ID.test(item.id) && !usedIds.has(item.id) ? item.id : '';
    while (!id || usedIds.has(id)) id = uid();
    usedIds.add(id);
    const doneAt = Number.isFinite(item.doneAt) && item.doneAt >= 0 ? item.doneAt : null;
    out.push({ id, type: item.type, name, doneAt });
  }
  return out;
}

export function loadState() {
  let raw = null;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val) {
      if (val.length > MAX_STORED) throw new Error('stored data too large');
      raw = JSON.parse(val);
    } else {
      raw = { tasks: [] };
    }
  } catch (e) {
    storageHealthy = false;
    toast("Saved data couldn't be read — starting fresh. Nothing will be saved until you reload.", { kind: 'error', duration: 0 });
  }
  const src = isPlainObject(raw) ? raw : {};
  state.tasks = normalizeTasks(src.tasks);
}

function writeNow() {
  if (!storageHealthy) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast("Couldn't save your checklist in this browser.", { kind: 'error' });
  }
}

export function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 150);
}

window.addEventListener('pagehide', () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; writeNow(); }
});

function todayReset(type, now) {
  const d = new Date(now);
  const r = RESETS[type];
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), r.hour, r.minute);
}

export function periodStart(type, now) {
  const t = todayReset(type, now);
  return t > now ? t - DAY : t;
}

export function nextReset(type, now) {
  return periodStart(type, now) + DAY;
}

export function isDone(task, now) {
  if (task.doneAt === null) return false;
  return task.type === 'once' || task.doneAt >= periodStart(task.type, now);
}

export function addTask(type, rawName) {
  if (!TYPES.includes(type)) return 'type';
  const name = cleanName(rawName);
  if (!name) return 'empty';
  if (state.tasks.length >= MAX_TASKS) return 'full';
  const key = nameKey(type, name);
  if (state.tasks.some(t => nameKey(t.type, t.name) === key)) return 'dup';
  state.tasks.push({ id: uid(), type, name, doneAt: null });
  saveState();
  return 'ok';
}

export function removeTask(id) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index === -1 || state.tasks[index].locked) return null;
  const [task] = state.tasks.splice(index, 1);
  saveState();
  return { task, index };
}

export function restoreTask(task, index) {
  const key = nameKey(task.type, task.name);
  if (state.tasks.some(t => nameKey(t.type, t.name) === key)) return false;
  state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
  saveState();
  return true;
}

export function setDone(id, done) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return null;
  const now = Date.now();
  const linked = [];
  task.doneAt = done ? now : null;
  if (done) {
    const prereq = state.tasks.find(t => t.id === LINKS[id]);
    if (prereq && !isDone(prereq, now)) {
      prereq.doneAt = now;
      linked.push(prereq);
    }
  } else {
    state.tasks.forEach(t => {
      if (LINKS[t.id] === id && isDone(t, now)) {
        t.doneAt = null;
        linked.push(t);
      }
    });
  }
  saveState();
  return linked;
}

export function setGroupDone(type, done) {
  const now = Date.now();
  const missionIds = new Set(LOCKED_TASKS.map(([id]) => id));
  state.tasks.forEach(t => {
    if (t.type === type && missionIds.has(t.id)) t.doneAt = done ? now : null;
  });
  saveState();
}

export function clearTicks() {
  const snapshot = new Map();
  state.tasks.forEach(t => {
    if (t.doneAt !== null) snapshot.set(t.id, t.doneAt);
    t.doneAt = null;
  });
  saveState();
  return snapshot;
}

export function restoreTicks(snapshot) {
  state.tasks.forEach(t => {
    if (snapshot.has(t.id)) t.doneAt = snapshot.get(t.id);
  });
  saveState();
}

export function exportState() {
  return JSON.stringify(state, null, 2);
}

export function importState(text) {
  try {
    if (typeof text !== 'string' || text.length > MAX_STORED) throw new Error('bad format');
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.tasks)) throw new Error('bad format');
    const incoming = normalizeTasks(parsed.tasks);
    const merged = [...state.tasks];
    let added = 0;
    for (const t of incoming) {
      if (t.locked) continue;
      if (merged.some(m => nameKey(m.type, m.name) === nameKey(t.type, t.name))) continue;
      if (merged.length >= MAX_TASKS) break;
      merged.push(t);
      added++;
    }
    state.tasks = merged;
    saveState();
    return { added, total: state.tasks.length };
  } catch (e) {
    return null;
  }
}