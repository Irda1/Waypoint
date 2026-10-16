import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placesUrl } from './index.ts';

const ok = { categories: 'tourism,leisure.park,religion.place_of_worship', lat: 35.01, lng: 135.76, radiusM: 5000, offset: 0 };

test('places-search : adresse Geoapify avec la clé du serveur', () => {
  assert.equal(placesUrl(ok, 'K/1'), 'https://api.geoapify.com/v2/places?categories=tourism,leisure.park,religion.place_of_worship&filter=circle:135.76,35.01,5000&bias=proximity:135.76,35.01&limit=500&offset=0&apiKey=K%2F1');
});

test('places-search : demandes refusées (catégories, coordonnées, rayon, page)', () => {
  for (const bad of [
    { ...ok, categories: 'tourism&apiKey=x' }, { ...ok, categories: '' }, { ...ok, categories: 'a'.repeat(301) },
    { ...ok, lat: 91 }, { ...ok, lng: '2' }, { ...ok, radiusM: 30_001 }, { ...ok, radiusM: 0 }, { ...ok, radiusM: 10.5 },
    { ...ok, offset: 1500 }, {},
  ]) assert.equal(placesUrl(bad as never, 'K'), null, JSON.stringify(bad).slice(0, 60));
});
