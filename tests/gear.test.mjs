import { test } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #values = new Map(); failKeys = null;
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { if (this.failKeys && this.failKeys.test(key)) throw new Error('quota'); this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
const Gear = await import('../public/js/gear.js');
const Accounts = await import('../public/js/accounts.js');

test('gear is scoped per profile, sanitised on load, and absent for guests', () => {
  Gear.useScope('p-a');
  assert.equal(Gear.add({ productId: 'gill-os2', brand: 'Gill', model: 'OS2', size: 'M' }).saved, true);
  Gear.useScope('p-b');
  assert.deepEqual(Gear.list(), []);
  Gear.useScope(null);
  assert.equal(Gear.add({ brand: 'X', model: 'Y' }).ok, false); // guests have no gear list
  storage.setItem('marinebuy:gear:p-c', JSON.stringify({ v: 1, items: [{ id: 'g-1', brand: 'B', model: 'M', fit: 'perfect', purchased: '2024-13' }, { id: 'bad id', brand: 'B', model: 'M' }, { id: 'g-2', brand: '', model: 'M' }, 'junk'] }));
  Gear.useScope('p-c');
  const [only] = Gear.list();
  assert.equal(Gear.list().length, 1);
  assert.equal(only.fit, ''); // unknown fit value dropped
  assert.equal(only.purchased, ''); // invalid month dropped, not guessed
  storage.setItem('marinebuy:gear:p-d', '{not json');
  Gear.useScope('p-d');
  assert.deepEqual(Gear.list(), []);
});

test('gear requires only brand and model; duplicates are same item + same size, sizes may differ', () => {
  Gear.useScope('p-dup');
  assert.equal(Gear.add({ brand: ' ', model: 'Shell' }).ok, false);
  const a = Gear.add({ productId: 'musto-br2', brand: 'Musto', model: 'BR2', size: 'L' }).item;
  assert.ok(Gear.duplicateOf({ productId: 'musto-br2', size: ' l ' }));
  assert.equal(Gear.duplicateOf({ productId: 'musto-br2', size: 'M' }), null);
  assert.equal(Gear.duplicateOf({ productId: 'musto-br2', size: 'L' }, a.id), null); // editing itself is not a duplicate
  Gear.add({ brand: 'Henri Lloyd', model: 'Old smock' });
  assert.ok(Gear.duplicateOf({ brand: 'henri  lloyd', model: 'OLD SMOCK', size: '' }));
  assert.equal(Gear.update(a.id, { fit: 'comfortable' }).item.fit, 'comfortable');
  assert.equal(Gear.remove(a.id).ok, true);
  assert.equal(Gear.list().length, 1);
});

test('failed writes are reported, not claimed as saved', () => {
  Gear.useScope('p-fail');
  storage.failKeys = /^marinebuy:gear/;
  const r = Gear.add({ brand: 'A', model: 'B' });
  assert.equal(r.ok, true); assert.equal(r.saved, false); assert.equal(Gear.persisted(), false);
  storage.failKeys = /^marinebuy:local-accounts/;
  const created = Accounts.create('Storage Test');
  assert.ok(created);
  assert.equal(Accounts.updateProfileData({ activities: ['racing'] }), false);
  assert.equal(Accounts.rename('Renamed').saved, false);
  storage.failKeys = null;
  assert.equal(Accounts.updateProfileData({ activities: ['racing'] }), true);
});

test('deleting a profile removes its gear but not another profile’s; saved priorities map to research priorities', () => {
  storage.failKeys = null;
  const keep = Accounts.create('Keeper');
  Gear.add({ brand: 'Keep', model: 'This' });
  Accounts.signOut();
  const gone = Accounts.create('Leaver');
  Gear.add({ brand: 'Drop', model: 'This' });
  assert.ok(storage.getItem(`marinebuy:gear:${gone.id}`));
  Accounts.deleteCurrent();
  assert.equal(storage.getItem(`marinebuy:gear:${gone.id}`), null);
  assert.ok(storage.getItem(`marinebuy:gear:${keep.id}`));
  assert.deepEqual(Accounts.researchPriorities({ priorities: ['price', 'movement'] }), { priorities: ['price', 'fit'], fitFocus: ['movement'] });
  assert.deepEqual(Accounts.researchPriorities({ priorities: [] }), { priorities: [], fitFocus: [] });
});
