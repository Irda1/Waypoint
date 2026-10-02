import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionProgress, fractionProgress } from './collection.ts';

test('avancement du chargement des lieux', () => {
  assert.deepEqual(collectionProgress([]), { percent: 100, ready: 0, total: 0, failed: 0, done: true });
  assert.equal(collectionProgress(['ready', 'ready']).percent, 100);
  assert.equal(collectionProgress(['ready', 'queued']).percent, 50);
  assert.equal(collectionProgress(['ready', 'collecting']).percent, 75);
  assert.equal(collectionProgress(['queued', 'empty']).done, false);
  assert.equal(collectionProgress(['ready', 'failed']).done, true);
});

test('avancement par fractions : moyenne des villes, une ville prête compte pour 1', () => {
  assert.deepEqual(fractionProgress([1, 0.5]), { percent: 75, ready: 1, total: 2, failed: 0, done: false });
  assert.equal(fractionProgress([1, 1]).done, true);
  assert.equal(fractionProgress([1, 0], 1).done, true);
  assert.equal(fractionProgress([]).percent, 100);
});
