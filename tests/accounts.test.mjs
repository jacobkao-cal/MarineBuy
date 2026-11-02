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
