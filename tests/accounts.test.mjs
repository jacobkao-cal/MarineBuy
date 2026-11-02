import { test } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
const Accounts = await import('../public/js/accounts.js');
const Likes = await import('../public/js/likes.js');
const WorkspaceState = await import('../public/js/workspace-state.js');

test('local profiles preserve guest state, isolate private data, copy on request, and delete scoped data', () => {
  const valid = () => true;
  Accounts.configure({ onScopeChange(profileId) {
    Likes.useScope(profileId);
    Likes.load(valid);
    WorkspaceState.useScope(profileId, valid);
  } });

  Likes.useScope(null);
  Likes.load(valid);
  WorkspaceState.useScope(null, valid);
  Likes.importIds(['gill-os2'], true);
  WorkspaceState.set({ notes: { 'gill-os2': 'Guest-only note' }, priorities: ['price'] });

  const first = Accounts.create('Alex', false);
  assert.ok(first);
  assert.equal(Accounts.current().displayName, 'Alex');
  assert.deepEqual(Likes.list(), []);
  assert.deepEqual(WorkspaceState.get().notes, {});
  Likes.importIds(['musto-br2'], false);
  WorkspaceState.set({ notes: { 'musto-br2': 'Profile-only note' } });

  Accounts.signOut();
  assert.deepEqual(Likes.list(), ['gill-os2']);
  assert.equal(WorkspaceState.get().notes['gill-os2'], 'Guest-only note');
  assert.equal(Accounts.list().length, 1);
  assert.equal(Accounts.signIn(first.id), true);
  assert.deepEqual(Likes.list(), ['musto-br2']);
  assert.equal(WorkspaceState.get().notes['musto-br2'], 'Profile-only note');

  Accounts.signOut();
  const second = Accounts.create('Bea', true);
  assert.ok(second);
  assert.deepEqual(Likes.list(), ['gill-os2']);
  assert.equal(WorkspaceState.get().notes['gill-os2'], 'Guest-only note');
  Likes.importIds(['musto-br2'], false);
  const secondKey = `${Likes.KEY}:${second.id}`;

  assert.equal(Accounts.deleteCurrent(), true);
  assert.equal(globalThis.localStorage.getItem(secondKey), null);
  assert.equal(Accounts.current(), null);
  assert.deepEqual(Likes.list(), ['gill-os2']);
  assert.deepEqual(Accounts.list().map(p => p.displayName), ['Alex']);
  assert.equal(Accounts.signIn(first.id), true);
  assert.deepEqual(Likes.list(), ['musto-br2']);
});

test('profile data is normalized when stored JSON contains malformed optional values', async () => {
  globalThis.localStorage.setItem(Accounts.KEY, JSON.stringify({
    v: 1, activeId: 'p-bad', profiles: [{
      id: 'p-bad', displayName: 'Sam',
      onboarding: { step: 99, complete: false, data: { activities: 'not-an-array', fit: null, measurements: { heightCm: 'tall' }, priorities: ['price', 'unknown'] } }
    }]
  }));
  const fresh = await import(`../public/js/accounts.js?malformed=${Date.now()}`);
  assert.equal(fresh.current().onboarding.step, 4);
  assert.deepEqual(fresh.current().onboarding.data.activities, []);
  assert.equal(fresh.current().onboarding.data.measurements.heightCm, null);
  assert.deepEqual(fresh.current().onboarding.data.priorities, ['price']);
});

test('measurements default to US units; older profiles switch to US only when nothing was entered or chosen', async () => {
  const profile = (id, measurements) => ({ id, displayName: id, onboarding: { step: 2, complete: false, data: { measurements } } });
  globalThis.localStorage.setItem(Accounts.KEY, JSON.stringify({ v: 1, activeId: 'p-new', profiles: [
    profile('p-new', {}),
    profile('p-legacy-empty', { lengthUnit: 'cm', weightUnit: 'kg', heightCm: null }),
    profile('p-legacy-values', { lengthUnit: 'cm', weightUnit: 'kg', heightCm: 180 }),
    profile('p-chose-metric', { lengthUnit: 'cm', weightUnit: 'kg', unitsChosen: true }),
    profile('p-mixed', { lengthUnit: 'in', weightUnit: 'kg', unitsChosen: true }),
  ] }));
  const fresh = await import(`../public/js/accounts.js?units=${Date.now()}`);
  const units = (id) => { fresh.signIn(id); const m = fresh.current().onboarding.data.measurements; return `${m.lengthUnit}/${m.weightUnit}`; };
  assert.equal(units('p-new'), 'in/lb');
  assert.equal(units('p-legacy-empty'), 'in/lb');
  assert.equal(units('p-legacy-values'), 'cm/kg');
  assert.equal(units('p-chose-metric'), 'cm/kg');
  assert.equal(units('p-mixed'), 'in/lb'); // a mixed pair is normalised to one system
  fresh.signOut();
  const created = fresh.create('Robin');
  assert.equal(`${created.onboarding.data.measurements.lengthUnit}/${created.onboarding.data.measurements.weightUnit}`, 'in/lb');
});

test('height uses feet + inches in US units: exact conversion, display rounding with carry, honest validation', () => {
  const { parseFeetInches: parse, feetInches, formatHeight } = Accounts;
  assert.deepEqual(parse('5', '9'), { cm: 175.26 });
  assert.deepEqual(parse('6', '0'), { cm: 182.88 }); // 0 inches is valid
  assert.deepEqual(parse('', ''), { cm: null }); // blank stays blank, never zero
  assert.deepEqual(parse(' 5 ', ' 9 '), { cm: 175.26 });
  assert.equal(formatHeight(69 * 2.54, 'in'), '5′9″'); // a height saved earlier as 69 total inches
  assert.equal(formatHeight(175.26, 'in'), '5′9″');
  assert.equal(formatHeight(182.88, 'in'), '6′0″');
  assert.equal(formatHeight(175.26, 'cm'), '175.26 cm');
  assert.equal(formatHeight(null, 'in'), '');
  assert.deepEqual(feetInches(71.9 * 2.54), { ft: 6, in: 0 }); // 11.9 in rounds to 12 and carries into feet
  assert.deepEqual(feetInches(69.4 * 2.54), { ft: 5, in: 9 });
  for (const [f, i, field] of [['5', '', 'inches'], ['', '9', 'feet'], ['5', '12', 'inches'], ['5', '9.5', 'inches'], ['5', '-1', 'inches'], ['5.5', '0', 'feet'], ['1', '0', 'feet'], ['9', '0', 'feet']]) {
    const r = parse(f, i);
    assert.ok(r.error && r.field === field && !('cm' in r), `${f}′${i}″ should be rejected on ${field}: ${JSON.stringify(r)}`);
  }
  assert.match(parse('5', '12').error, /0 to 11/);
  assert.match(parse('5', '').error, /Use 0/);
  assert.deepEqual(parse('', '', { inches: true }).field, 'inches'); // unparseable browser input is not treated as blank
  // Repeated display/parse round trips never move the canonical height.
  let cm = 175.26;
  for (let k = 0; k < 50; k++) { const h = feetInches(cm); cm = parse(String(h.ft), String(h.in)).cm; }
  assert.equal(cm, 175.26);
});
