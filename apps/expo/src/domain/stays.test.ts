import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysForStay, nightsByStay } from './stays.ts';

const days = [
  { id: 'a', city_id: 1, stay_id: null },
  { id: 'b', city_id: 1, stay_id: 's0' },
  { id: 'c', city_id: 2, stay_id: null },
  { id: 'd', city_id: null, stay_id: null },
];

test('jours d\'un hébergement : ceux de la ville sans hébergement', () => {
  assert.deepEqual(daysForStay(days, 1, 2), ['a']);
  assert.deepEqual(daysForStay(days, 2, 2), ['c']);
});

test('jours sans ville : rattachés seulement s\'il n\'y a qu\'une destination', () => {
  assert.deepEqual(daysForStay(days, 1, 1), ['a', 'd']);
  assert.deepEqual(daysForStay(days, 1, 2), ['a']);
});

test('nuits par hébergement', () => {
  assert.deepEqual([...nightsByStay(days)], [['s0', 1]]);
});
