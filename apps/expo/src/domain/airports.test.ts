import test from 'node:test';
import assert from 'node:assert/strict';
import { airportNear } from './airports.ts';

test('villes desservies', () => {
  assert.equal(airportNear(35.6895, 139.6917) !== null, true); // Tokyo
  assert.equal(airportNear(38.7223, -9.1393), 'LIS'); // Lisbonne
});
test('village sans aéroport proche', () => {
  assert.equal(airportNear(46.2, 2.2 + 0.0), null); // centre de la France, loin de tout
});

test('un aéroport ne donne l’avion qu’à une seule ville', async () => {
  const { airportCities } = await import('./airports.ts');
  // Paris (CDG ~23 km, ORY ~14 km) et une petite ville voisine plus loin des deux aéroports.
  const ids = airportCities([{ id: 1, lat: 48.857, lng: 2.352 }, { id: 2, lat: 48.80, lng: 2.13 }]);
  assert.ok(ids.has(1));
  assert.ok(!ids.has(2));
});

test('airportCities : l\'aéroport va à la ville la plus importante qu\'il dessert (Haneda → Tokyo, pas Ōta)', async () => {
  const { airportCities } = await import('./airports.ts');
  // Classées par importance : Tokyo, puis l'arrondissement d'Ōta (plus proche de Haneda).
  const ids = airportCities([{ id: 1, lat: 35.69, lng: 139.69 }, { id: 2, lat: 35.561, lng: 139.716 }]);
  assert.ok(ids.has(1));
  assert.ok(!ids.has(2));
});

test('aéroports proches d\'une ville, du plus proche au plus lointain', async () => {
  const { airportsNear } = await import('./airports.ts');
  assert.deepEqual(airportsNear(48.8566, 2.3522).map((a) => a.iata), ['ORY', 'CDG', 'BVA']);
  assert.equal(airportsNear(0, -30).length, 0);
});
