import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankCities, titleWords } from './cities.ts';

const cities = [
  { id: 1, names: ['Tokyo', 'Tōkyō'], collection_status: 'empty' },
  { id: 2, names: ['Paris'], collection_status: 'ready' },
  { id: 3, names: ['Lisbonne', 'Lisboa'], collection_status: 'empty' },
  { id: 4, names: ['Porto'], collection_status: 'ready' },
];

test('villes : celles du titre passent en premier, même sans lieux collectés', () => {
  const ids = rankCities(cities, { title: 'Lisbonne Porto' }).map((c) => c.id);
  assert.deepEqual(ids, [3, 4, 2, 1]);
});

test('villes : le nom d\'origine et les accents sont reconnus', () => {
  assert.equal(rankCities(cities, { title: 'LISBOA 2026' })[0].id, 3);
  assert.equal(rankCities(cities, { title: 'Escale à Tōkyō' })[0].id, 1);
});

test('villes : la ville déjà choisie pour le jour passe avant tout', () => {
  assert.equal(rankCities(cities, { title: 'Lisbonne Porto', preferredId: 4 })[0].id, 4);
});

test('villes : sans indice, les villes avec lieux d\'abord, puis l\'ordre d\'origine', () => {
  assert.deepEqual(rankCities(cities, { title: 'Vacances' }).map((c) => c.id), [2, 4, 1, 3]);
});

test('titre : mots de 4 lettres ou plus, sans accents, doublons ni mots courants', () => {
  assert.deepEqual(titleWords('Lisbonne entre amis à Lisbonne + Porto'), ['lisbonne', 'porto']);
});

test('villes : les destinations du voyage passent avant les autres, même absentes du titre', () => {
  const ids = rankCities(cities, { title: 'Vacances', priorityIds: [1] }).map((c) => c.id);
  assert.deepEqual(ids, [1, 2, 4, 3]);
});
