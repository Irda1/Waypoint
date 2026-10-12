import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyTitle, shiftedRange, suggestStart } from './copyTrip.ts';

test('copyTitle : année remplacée ou ajoutée', () => {
  assert.equal(copyTitle('Portugal en famille', '2027-05-08'), 'Portugal en famille 2027');
  assert.equal(copyTitle('Japon 2026', '2027-04-01'), 'Japon 2027');
  assert.equal(copyTitle('Japon 2026', null), 'Japon');
  assert.equal(copyTitle('2026', '2027-01-01'), '2026 2027');
});

test('suggestStart : même jour l’an prochain, sinon dans 30 jours', () => {
  assert.equal(suggestStart('2026-05-12', '2026-10-12'), '2027-05-12');
  assert.equal(suggestStart('2024-02-29', '2024-10-01'), '2025-02-28');
  assert.equal(suggestStart('2020-05-12', '2026-10-12'), '2026-11-11');
  assert.equal(suggestStart(null, '2026-10-12'), null);
});

test('shiftedRange : même durée', () => {
  assert.deepEqual(shiftedRange('2026-05-12', '2026-05-19', '2027-05-08'), { end: '2027-05-15', days: 8 });
  assert.deepEqual(shiftedRange(null, null, '2027-05-08'), { end: null, days: null });
});
