import test from 'node:test';
import assert from 'node:assert/strict';
import { cityRuns } from './dayruns.ts';

test('cityRuns : jours consécutifs d\'une même ville regroupés', () => {
  assert.deepEqual(cityRuns([1, 1, 1, 2, 2, 1]), [
    { cityId: 1, start: 0, count: 3 },
    { cityId: 2, start: 3, count: 2 },
    { cityId: 1, start: 5, count: 1 },
  ]);
});

test('cityRuns : aucune journée, ou ville inconnue', () => {
  assert.deepEqual(cityRuns([]), []);
  assert.deepEqual(cityRuns([null, null]), [{ cityId: null, start: 0, count: 2 }]);
});
