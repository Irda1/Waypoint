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
