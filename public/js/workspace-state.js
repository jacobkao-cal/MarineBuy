import { PRIORITIES, FIT_FOCUS, ROWS } from './research.js';
export const KEY = 'marinebuy:workspace';
let activeKey = KEY;
const defaults = () => ({ priorities: [], fitFocus: [], notes: {}, rows: ROWS.filter(r => !r.detail).map(r => r.id), differences: false, tab: 'overview', optionsOpen: true });
let saved = true;
export const persisted = () => saved;
let state = defaults(), valid = () => true;
export const get = () => structuredClone(state);
export function load(isValid = valid) {
  valid = isValid;
  let d; try { d = JSON.parse(globalThis.localStorage?.getItem(activeKey) || 'null'); } catch { /* blocked or malformed */ }
  state = defaults(); saved = true;
  if (!d || typeof d !== 'object') return;
  // v1 had a "movement" priority; it now lives under "Help with fit" → "Easier movement".
  const legacyMovement = Array.isArray(d.priorities) && d.priorities.includes('movement');
  const pr = Array.isArray(d.priorities) ? [...d.priorities, ...(legacyMovement ? ['fit'] : [])] : [];
  state.priorities = PRIORITIES.filter(p => pr.includes(p.id)).map(p => p.id);
  const ff = Array.isArray(d.fitFocus) ? [...d.fitFocus, ...(legacyMovement ? ['movement'] : [])] : legacyMovement ? ['movement'] : [];
  state.fitFocus = state.priorities.includes('fit') ? FIT_FOCUS.filter(f => ff.includes(f.id)).map(f => f.id) : [];
  state.rows = Array.isArray(d.rows) ? ROWS.filter(r => d.rows.includes(r.id)).map(r => r.id) : state.rows;
  state.differences = d.differences === true;
  state.optionsOpen = d.optionsOpen !== false;
  state.tab = ['overview', 'research', 'videos', 'notes'].includes(d.tab) ? d.tab : 'overview';
  if (d.notes && typeof d.notes === 'object') for (const [id, note] of Object.entries(d.notes)) if (valid(id) && typeof note === 'string') state.notes[id] = note.slice(0, 2000);
}
export function set(patch) {
  state = { ...state, ...patch };
  try { if (!globalThis.localStorage) throw new Error('Storage unavailable'); globalThis.localStorage.setItem(activeKey, JSON.stringify({ v: 1, ...state })); saved = true; } catch { saved = false; /* retain in memory */ }
}
export function note(id, text) { if (valid(id)) set({ notes: { ...state.notes, [id]: text.slice(0, 2000) } }); }
export const storageKey = () => activeKey;
export function useScope(profileId = null, isValid = valid) {
  activeKey = profileId ? `${KEY}:${profileId}` : KEY;
  load(isValid);
}
