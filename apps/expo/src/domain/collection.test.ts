import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionProgress } from './collection.ts';

test('avancement du chargement des lieux', () => {
  assert.deepEqual(collectionProgress([]), { percent: 100, ready: 0, total: 0, failed: 0, done: true });
  assert.equal(collectionProgress(['ready', 'ready']).percent, 100);
  assert.equal(collectionProgress(['ready', 'queued']).percent, 50);
  assert.equal(collectionProgress(['ready', 'collecting']).percent, 75);
  assert.equal(collectionProgress(['queued', 'empty']).done, false);
  assert.equal(collectionProgress(['ready', 'failed']).done, true);
});
