import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt, recapDays, recapStats } from './recap.ts';

test('recapStats : chiffres du voyage', () => {
  const s = recapStats({
    days: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    destinations: [{ lat: 38.72, lng: -9.14 }, { lat: 38.80, lng: -9.39 }, { lat: 41.15, lng: -8.61 }],
    items: [{ place_id: 1, plan: 'A' }, { place_id: 2, plan: 'B' }, { place_id: null, plan: 'A' }, { place_id: 3, plan: 'A' }],
    expenses: [{ amount: 12.5 }, { amount: 30 }],
    photos: [1, 2, 3],
    notes: [{ note: 'Super' }, { note: '  ' }],
  });
  assert.deepEqual({ ...s, km: undefined }, { days: 3, cities: 3, km: undefined, places: 2, spent: 43, photos: 3, pages: 1 });
  assert.ok(s.km > 280 && s.km < 320, `km = ${s.km}`);
  assert.equal(recapStats({ days: [], destinations: [], items: [], expenses: [], photos: [], notes: [] }).km, 0);
});

test('recapDays : jours avec photos d’abord, puis ordre du voyage', () => {
  const days = ['d1', 'd2', 'd3', 'd4', 'd5'].map((id) => ({ id }));
  const photos = new Set(['d4', 'd2']);
  const notes = new Set(['d1', 'd3', 'd4']);
  const pick = (max: number) => recapDays(days, (id) => photos.has(id), (id) => notes.has(id), max).map((d) => d.id);
  assert.deepEqual(pick(6), ['d1', 'd2', 'd3', 'd4']);
  assert.deepEqual(pick(3), ['d1', 'd2', 'd4']);
});

test('excerpt : coupe proprement', () => {
  assert.equal(excerpt('  Court.  '), 'Court.');
  assert.equal(excerpt('Première phrase assez longue pour compter. Deuxième phrase qui dépasse nettement la limite fixée.', 60), 'Première phrase assez longue pour compter.');
  assert.match(excerpt('a'.repeat(10) + ' ' + 'b'.repeat(200), 50), /…$/);
});
