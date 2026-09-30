import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSnapshot, encodeSnapshot, savedLabel } from './offlineSnapshot.ts';

test('les Map survivent à l\'aller-retour, y compris imbriquées dans un objet', () => {
  const data = { title: 'Lisbonne', places: new Map([[1, { name: 'Belém' }], [2, { name: 'Alfama' }]]), days: [{ id: 'd1' }] };
  const back = decodeSnapshot<typeof data>(encodeSnapshot(data, 1000))!;
  assert.equal(back.savedAt, 1000);
  assert.ok(back.data.places instanceof Map);
  assert.equal(back.data.places.get(2)!.name, 'Alfama');
  assert.deepEqual(back.data.days, [{ id: 'd1' }]);
});

test('texte absent, abîmé ou d\'une autre version : pas de copie', () => {
  assert.equal(decodeSnapshot(null), null);
  assert.equal(decodeSnapshot('{pas du json'), null);
  assert.equal(decodeSnapshot(JSON.stringify({ v: 99, savedAt: 1, data: {} })), null);
  assert.equal(decodeSnapshot(JSON.stringify({ v: 1, savedAt: 'x', data: {} })), null);
});

test('libellé de date en français', () => {
  const t = new Date(2026, 8, 30, 18, 5).getTime();
  assert.equal(savedLabel(t), 'le 30 sept. à 18:05');
});
