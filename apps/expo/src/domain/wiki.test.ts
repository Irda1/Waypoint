import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortExtract, wikiTarget } from './wiki.ts';

test('cible : étiquette wikipedia d\'abord, puis Wikidata, sinon rien', () => {
  assert.deepEqual(wikiTarget({ tags: { wikipedia: 'fr:Tour de Belém' } }), { kind: 'title', lang: 'fr', title: 'Tour de Belém' });
  assert.deepEqual(wikiTarget({ tags: { wikipedia: 'en:Belém Tower', wikidata: 'Q1' }, wikidata_id: 'Q9' }), { kind: 'title', lang: 'en', title: 'Belém Tower' });
  assert.deepEqual(wikiTarget({ wikidata_id: 'Q42' }), { kind: 'wikidata', id: 'Q42' });
  assert.deepEqual(wikiTarget({ tags: { wikidata: 'Q7' } }), { kind: 'wikidata', id: 'Q7' });
  assert.equal(wikiTarget({ tags: { name: 'x' } }), null);
  assert.equal(wikiTarget({ wikidata_id: 'pas-un-id' }), null);
});

test('extrait : phrases entières, limite de longueur, parenthèses longues retirées', () => {
  const t = 'La tour de Belém est une tour fortifiée de Lisbonne. Elle a été construite au XVIe siècle pour défendre l\'entrée du Tage. Elle est classée au patrimoine mondial.';
  assert.equal(shortExtract(t, 130), 'La tour de Belém est une tour fortifiée de Lisbonne. Elle a été construite au XVIe siècle pour défendre l\'entrée du Tage.');
  assert.equal(shortExtract('Court.', 100), null);
  assert.equal(shortExtract(null), null);
  const long = 'mot '.repeat(100);
  const cut = shortExtract(long, 60)!;
  assert.ok(cut.length <= 61 && cut.endsWith('…'));
});
