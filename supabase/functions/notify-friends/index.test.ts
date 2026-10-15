import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_WAIT_MS, QUIET_MS, messageFor, readyGroups } from './index.ts';
import type { Group, Kind, QueueRow } from './index.ts';

const NOW = Date.parse('2026-10-15T18:00:00Z');
let id = 0;
const row = (kind: Kind, action: string, label = '', agoMs = QUIET_MS + 1000, over: Partial<QueueRow> = {}): QueueRow =>
  ({ id: ++id, trip_id: 't1', actor: 'clara', kind, action, label, amount: null, currency: null, created_at: new Date(NOW - agoMs).toISOString(), ...over });
const group = (kind: Kind, rows: QueueRow[]): Group => ({ tripId: 't1', actor: 'clara', kind, rows });

test('regroupement : par ami, voyage et type ; on attend que l\'ami ait fini', () => {
  const rows = [row('programme', 'ajout', 'A'), row('programme', 'ajout', 'B'), row('depenses', 'paiement', 'Dîner'), row('programme', 'ajout', 'C', 0, { actor: 'tom' })];
  const ready = readyGroups(rows, NOW);
  assert.deepEqual(ready.map((g) => `${g.actor} ${g.kind} ${g.rows.length}`), ['clara programme 2', 'clara depenses 1'], 'Tom vient de changer : on attend');
  const busy = [row('programme', 'ajout', 'A', MAX_WAIT_MS + 1000), row('programme', 'ajout', 'B', 1000)];
  assert.equal(readyGroups(busy, NOW).length, 1, 'au-delà de 15 minutes, on envoie même s\'il continue');
});

test('textes : une étape, plusieurs étapes, dépense, remboursement, réservation, carnet, voyageurs', () => {
  assert.deepEqual(messageFor(group('programme', [row('programme', 'ajout', 'Torre de Belém')]), 'Clara', 'Portugal'), { title: 'Clara a ajouté Torre de Belém', body: 'Programme · Portugal' });
  assert.deepEqual(messageFor(group('programme', [row('programme', 'modif', 'Sé'), row('programme', 'ajout', 'Lello'), row('programme', 'ajout', 'Sé')]), 'Clara', 'Portugal'),
    { title: 'Clara a changé le programme', body: '3 étapes : Sé, Lello · Portugal' });
  const pay = messageFor(group('depenses', [row('depenses', 'paiement', 'Dîner', undefined, { amount: '64.00', currency: 'EUR' })]), 'Clara', 'Portugal');
  assert.match(pay.title, /^Clara a payé 64\s€$/);
  assert.equal(pay.body, 'Dîner · Portugal');
  assert.match(messageFor(group('depenses', [row('depenses', 'remboursement', '', undefined, { amount: 12.5, currency: 'EUR' })]), 'Tom', 'Portugal').title, /^Tom a enregistré un remboursement de 12,50\s€$/);
  assert.equal(messageFor(group('reservations', [row('reservations', 'billet', 'Vol Paris → Lisbonne')]), 'Tom', 'Portugal').title, 'Tom a joint un billet');
  assert.equal(messageFor(group('carnet', [row('carnet', 'photo'), row('carnet', 'photo'), row('carnet', 'note')]), 'Tom', 'Portugal').title, 'Tom a ajouté 2 photos');
  assert.deepEqual(messageFor(group('voyageurs', [row('voyageurs', 'rejoint')]), 'Léa', 'Portugal'), { title: 'Léa a rejoint le voyage', body: 'Portugal' });
});
