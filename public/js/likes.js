// Private Likes: a visitor's saved jackets and 2–4 comparison picks.
// Stored in this browser under KEY (guest) or a profile-scoped key. Nothing is sent to the server.
// Shape: {"v":1,"ids":["gill-os2",...],"sel":["gill-os2",...]} (sel is a subset of ids, max 4)
export const KEY = 'marinebuy:likes', MAX_CMP = 4, MAX_LIKES = 200;
let ids = [], sel = [], selectionInitialized = false, valid = () => true;
let activeKey = KEY;
const subs = new Set();
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const uniq = (a, ok) => [...new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === 'string' && ok(x)))];
function apply(d) {
  ids = uniq(d?.ids, valid).slice(0, MAX_LIKES);
  sel = uniq(d?.sel, (x) => ids.includes(x)).slice(0, MAX_CMP);
  selectionInitialized = d?.selectionInitialized === true || sel.length > 0;
}
function read() {
  let raw = null;
  try { raw = store()?.getItem(activeKey) ?? null; } catch { /* storage blocked */ }
  if (raw == null) return { had: false, d: null };
  try { return { had: true, d: JSON.parse(raw) }; } catch { return { had: true, d: null }; }
}
function save() {
  try { store()?.setItem(activeKey, JSON.stringify({ v: 1, ids, sel, selectionInitialized })); } catch { /* full or blocked: keep in memory */ }
  subs.forEach((f) => f());
}

/** True when localStorage can actually be written (false in some private windows). */
export function available() {
  try { const s = store(); if (!s) return false; s.setItem(activeKey + ':t', '1'); s.removeItem(activeKey + ':t'); return true; } catch { return false; }
}
export const storageKey = () => activeKey;
/** Switch between the anonymous visitor's state and a profile's isolated state. */
export function useScope(profileId = null) {
  activeKey = profileId ? `${KEY}:${profileId}` : KEY;
  const { d } = read();
  apply(d);
  subs.forEach((f) => f());
}
export const exportState = () => ({ v: 1, ids: [...ids], sel: [...sel], selectionInitialized });
export function importState(data) { apply(data); save(); }
/** Load saved state. isValid(id) rejects products no longer in the catalog. Returns {fresh, dropped}. */
export function load(isValid) {
  valid = isValid || (() => true);
  const { had, d } = read();
  const before = new Set(Array.isArray(d?.ids) ? d.ids.filter((x) => typeof x === 'string') : []).size;
  apply(d);
  const dropped = Math.max(0, before - ids.length);
  if (had && (dropped || !d || d.v !== 1)) try { store()?.setItem(activeKey, JSON.stringify({ v: 1, ids, sel, selectionInitialized })); } catch { /* ignore */ }
  return { fresh: !had, dropped };
}
/** Re-read after another tab changed storage. */
export function reload() { apply(read().d); subs.forEach((f) => f()); }
export const onChange = (f) => (subs.add(f), () => subs.delete(f));
export const list = () => [...ids];
export const selected = () => [...sel];
export const count = () => ids.length;
export const has = (id) => ids.includes(id);
export const isSelected = (id) => sel.includes(id);

/** Like or unlike. Returns the new liked state. Unliking also drops it from the comparison selection. */
export function toggle(id) {
  if (has(id)) { remove(id); return false; }
  if (!valid(id) || ids.length >= MAX_LIKES) return false;
  ids = [...ids, id]; save(); return true;
}
export function remove(id) {
  if (!has(id)) return;
  ids = ids.filter((x) => x !== id); sel = sel.filter((x) => x !== id); if (!ids.length) selectionInitialized = false; save();
}
/** Select/unselect a liked jacket for comparison. Returns false if refused (not liked, or already 4 selected). */
export function setSelected(id, on) {
  selectionInitialized = true;
  if (!on) { if (isSelected(id)) { sel = sel.filter((x) => x !== id); save(); } return true; }
  if (isSelected(id)) return true;
  if (!has(id) || sel.length >= MAX_CMP) return false;
  sel = [...sel, id]; save(); return true;
}
export function ensureSelection() {
  if (selectionInitialized || !ids.length) return;
  sel = ids.slice(0, 2); selectionInitialized = true; save();
}
export function clearSelection() { selectionInitialized = true; if (sel.length) { sel = []; save(); } }
export function clearAll() { ids = []; sel = []; selectionInitialized = false; save(); }
/** Add several IDs at once (used for the one-time migration of an old comparison). Returns the IDs newly added. */
export function importIds(list, select) {
  const add = uniq(list, (x) => valid(x) && !ids.includes(x)).slice(0, MAX_LIKES - ids.length);
  ids = [...ids, ...add];
  if (select) { sel = uniq([...sel, ...list], (x) => ids.includes(x)).slice(0, MAX_CMP); selectionInitialized = true; }
  save(); return add;
}
