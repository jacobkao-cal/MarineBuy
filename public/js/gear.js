// My gear: a private, user-entered record of equipment a profile says it owns.
// Stored only in this browser under KEY:<profileId>; guests have no gear list. Never sent to the server or an AI provider.
// Record: { id, productId|null, brand, model, size, purchased 'YYYY-MM'|'', retailer, fit, fitAreas, notes, createdAt, updatedAt }
export const KEY = 'marinebuy:gear';
export const FIT = [['tight', 'Too tight'], ['comfortable', 'Comfortable'], ['loose', 'Too loose'], ['unsure', 'Not sure']];
let activeKey = null, items = [], saved = true;
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
function clean(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !/^g-[a-zA-Z0-9-]+$/.test(x.id)) return null;
  const item = {
    id: x.id, productId: typeof x.productId === 'string' && x.productId ? x.productId.slice(0, 80) : null,
    brand: str(x.brand, 60), model: str(x.model, 120), size: str(x.size, 30),
    purchased: typeof x.purchased === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x.purchased) ? x.purchased : '',
    retailer: str(x.retailer, 80), fit: FIT.some(f => f[0] === x.fit) ? x.fit : '',
    fitAreas: str(x.fitAreas, 500), notes: str(x.notes, 1000),
    createdAt: typeof x.createdAt === 'string' ? x.createdAt : '', updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : '',
  };
  return item.brand && item.model ? item : null;
}
function write() {
  if (!activeKey) { saved = false; return false; }
  try { const s = store(); if (!s) throw new Error('Storage unavailable'); s.setItem(activeKey, JSON.stringify({ v: 1, items })); saved = true; }
  catch { saved = false; /* keep in memory for this visit */ }
  return saved;
}
/** Switch to a profile's gear (null = signed out: no gear). Malformed records are dropped. */
export function useScope(profileId = null) {
  activeKey = profileId ? `${KEY}:${profileId}` : null; items = []; saved = true;
  if (!activeKey) return;
  try { const d = JSON.parse(store()?.getItem(activeKey) || 'null'); if (Array.isArray(d?.items)) items = d.items.map(clean).filter(Boolean); }
  catch { /* blocked or malformed: start empty */ }
}
export const list = () => structuredClone(items);
export const get = id => structuredClone(items.find(x => x.id === id) || null);
export const persisted = () => saved;
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Another record with the same item and size (ignoring `exceptId`), or null. Different sizes are intentional and allowed. */
export function duplicateOf(item, exceptId = null) {
  return structuredClone(items.find(x => x.id !== exceptId && norm(x.size) === norm(item.size) &&
    (item.productId ? x.productId === item.productId : !x.productId && norm(x.brand) === norm(item.brand) && norm(x.model) === norm(item.model))) || null);
}
/** Returns { ok, item, saved } — ok:false when the brand/model is missing; saved:false when storage failed. */
export function add(data) {
  if (!activeKey) return { ok: false, saved: false };
  const now = new Date().toISOString();
  const id = `g-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const item = clean({ ...data, id, createdAt: now, updatedAt: now });
  if (!item) return { ok: false, saved: false };
  items = [...items, item];
  return { ok: true, item: structuredClone(item), saved: write() };
}
export function update(id, data) {
  const old = items.find(x => x.id === id);
  if (!old) return { ok: false, saved: false };
  const item = clean({ ...old, ...data, id, createdAt: old.createdAt, updatedAt: new Date().toISOString() });
  if (!item) return { ok: false, saved: false };
  items = items.map(x => x.id === id ? item : x);
  return { ok: true, item: structuredClone(item), saved: write() };
}
export function remove(id) {
  if (!items.some(x => x.id === id)) return { ok: false, saved: false };
  items = items.filter(x => x.id !== id);
  return { ok: true, saved: write() };
}
