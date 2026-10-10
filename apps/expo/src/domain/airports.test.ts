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

test('l’avion va seulement à la ville la plus proche de chaque aéroport', async () => {
  const { airportCities } = await import('./airports.ts');
  // Paris (CDG ~23 km, ORY ~14 km) et une petite ville voisine plus loin des deux aéroports.
  const ids = airportCities([{ id: 1, lat: 48.857, lng: 2.352 }, { id: 2, lat: 48.80, lng: 2.13 }]);
  assert.ok(ids.has(1));
  assert.ok(!ids.has(2));
});
