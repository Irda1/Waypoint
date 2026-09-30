import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLabel, missingSuggestions, orderItems, progress, SUGGESTIONS } from './checklist.ts';

const it = (id: string, label: string, done = false) => ({ id, label, done });

test('suggestions : celles déjà présentes (accents, casse) sont écartées', () => {
  const left = missingSuggestions([it('1', 'passeport / carte d’identité'.replace('’', "'")), it('2', 'ECOUTEURS')]);
  assert.equal(left.length, SUGGESTIONS.length - 2);
  assert.ok(!left.includes('Écouteurs'));
});

test('ordre : à faire d\'abord, l\'ordre interne est conservé', () => {
  const out = orderItems([it('a', 'A', true), it('b', 'B'), it('c', 'C', true), it('d', 'D')]);
  assert.deepEqual(out.map((x) => x.id), ['b', 'd', 'a', 'c']);
});

test('progression', () => { assert.deepEqual(progress([it('a', 'A', true), it('b', 'B')]), { done: 1, total: 2 }); });

test('nouvel élément : espaces nettoyés, vide et doublon refusés', () => {
  const list = [it('a', 'Crème solaire')];
  assert.equal(cleanLabel('  Maillot   de bain ', list), 'Maillot de bain');
  assert.equal(cleanLabel('   ', list), null);
  assert.equal(cleanLabel('creme SOLAIRE', list), null);
  assert.equal(cleanLabel('x'.repeat(300), list)!.length, 120);
});
