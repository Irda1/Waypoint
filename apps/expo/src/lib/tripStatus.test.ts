import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripStatus } from './dates.ts';
import { tripStatusLabel } from './format.ts';

test('statut du voyage : à venir, en cours, terminé, sans dates', () => {
  assert.deepEqual(tripStatus(null, null, '2026-10-01'), { kind: 'undated' });
  assert.deepEqual(tripStatus('2026-10-05', '2026-10-08', '2026-10-01'), { kind: 'upcoming', inDays: 4 });
  assert.deepEqual(tripStatus('2026-10-05', '2026-10-08', '2026-10-05'), { kind: 'ongoing', day: 1, total: 4 });
  assert.deepEqual(tripStatus('2026-10-05', '2026-10-08', '2026-10-08'), { kind: 'ongoing', day: 4, total: 4 });
  assert.deepEqual(tripStatus('2026-10-05', '2026-10-08', '2026-10-09'), { kind: 'past' });
  assert.deepEqual(tripStatus('2026-10-05', null, '2026-10-05'), { kind: 'ongoing', day: 1, total: 1 });
});

test('libellés du statut', () => {
  assert.equal(tripStatusLabel({ kind: 'upcoming', inDays: 1 }), 'Demain');
  assert.equal(tripStatusLabel({ kind: 'upcoming', inDays: 12 }), 'Dans 12 jours');
  assert.equal(tripStatusLabel({ kind: 'ongoing', day: 2, total: 4 }), 'Jour 2 sur 4');
  assert.equal(tripStatusLabel({ kind: 'past' }), 'Terminé');
  assert.equal(tripStatusLabel({ kind: 'undated' }), 'Dates à définir');
});
