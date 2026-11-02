import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggestion, compareData, visibleRows, ROWS } from '../public/js/research.js';
const products = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url)));
const offers = JSON.parse(readFileSync(new URL('../data/offers.json', import.meta.url)));
const pair = products.slice(0, 2);
test('actual checked prices produce a conditional $35 comparison, with dated sources', () => {
  const r = suggestion(pair, 'price', offers);
  assert.match(r.text, /Among your selected jackets/); assert.match(r.text, /\$395.00/);
  assert.match(r.basis, /\$35.00/); assert.equal(r.evidence.length, 2);
  assert.match(r.evidence[0].label, /2026-10-15/);
});
test('unverified prices cannot silently count as more expensive', () => {
  const r = suggestion(products, 'price', offers);
  assert.match(r.text, /with checked prices/); assert.match(r.caveat, /2 selected jacket/);
  assert.match(r.caveat, /they may cost less/);
  assert.equal(compareData(products.slice(2, 3), 'price', offers).comparable, false);
});
test('unmatched currencies and undated prices cannot be ranked', () => {
  assert.equal(compareData(pair, 'price', offers.map((o, i) => ({ ...o, currency: i === 1 ? 'EUR' : 'USD' }))).comparable, false);
  assert.equal(compareData(pair, 'price', offers.map(o => ({ ...o, chk: null }))).comparable, false);
});
test('current dataset never invents weights or ranks incompatible waterproofing and breathability', () => {
  assert.match(suggestion(pair, 'weight', offers).text, /No garment weights/);
  assert.match(suggestion(pair, 'weather', offers).text, /matching test methods are not provided/);
  assert.match(suggestion([products[0], products[2]], 'breathability', offers).text, /no comparable breathability test/);
  assert.match(suggestion(pair, 'layers', offers).text, /do not establish/);
  assert.match(suggestion(pair, 'fit', offers).text, /do not establish which jacket will fit your body/);
});
test('weights compare only with explicit matching size, garment basis and source, preserving units', () => {
  const mock = structuredClone(pair);
  mock[0].spec.weight = { value: .65, unit: 'kg', size: 'M', basis: 'dry complete jacket', source: 'https://example.com/a' };
  mock[1].spec.weight = { value: 820, unit: 'g', size: 'M', basis: 'dry complete jacket', source: 'https://example.com/b' };
  const r = suggestion(mock, 'weight', []);
  assert.match(r.text, /650 g/); assert.match(r.basis, /170 g heavier/); assert.match(r.evidence[0].label, /0.65 kg/);
  mock[1].spec.weight.size = 'L'; assert.equal(compareData(mock, 'weight', []).comparable, false);
  mock[1].spec.weight.size = 'M'; delete mock[1].spec.weight.source;
  assert.equal(compareData(mock, 'weight', []).comparable, false);
});
test('priority rows move first, remain aligned, and override hidden and identical row filters', () => {
  const settings = { rows: ROWS.map(r => r.id), differences: true };
  assert.ok(!visibleRows(pair, [], settings, offers).some(r => r.id === 'weight'));
  settings.rows = [];
  const rows = visibleRows(pair, ['weight', 'weather'], settings, offers).map(r => r.id);
  assert.deepEqual(rows, ['weight', 'wp', 'hood', 'con']);
});
test('ties have no arbitrary winner; fewer than two products asks for another', () => {
  const equal = offers.map(o => ({ ...o, price: 300 }));
  assert.match(suggestion(pair, 'price', equal).text, /tied/);
  assert.match(suggestion(pair.slice(0, 1), 'price', offers).text, /Select at least two/);
});

test('malformed workspace storage, removed products, and unavailable storage degrade safely', async () => {
  const state = await import('../public/js/workspace-state.js');
  let stored = '{{bad json';
  globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  state.load(id => id === 'gill-os2'); assert.deepEqual(state.get().priorities, []);
  stored = JSON.stringify({ priorities: ['price', 'fake', 'price'], notes: { 'removed-model': 'old', 'gill-os2': 'my note' }, rows: ['wp', 'bad'], tab: 'fake', differences: 'yes' });
  state.load(id => id === 'gill-os2');
  assert.deepEqual(state.get().priorities, ['price']); assert.deepEqual(state.get().notes, { 'gill-os2': 'my note' });
  assert.deepEqual(state.get().rows, ['wp']); assert.equal(state.get().tab, 'overview'); assert.equal(state.get().differences, false);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage blocked'); } });
  state.load(); state.set({ priorities: ['weight'] }); state.note('gill-os2', 'in memory');
  assert.deepEqual(state.get().priorities, ['weight']); assert.equal(state.get().notes['gill-os2'], 'in memory');
  delete globalThis.localStorage;
});
