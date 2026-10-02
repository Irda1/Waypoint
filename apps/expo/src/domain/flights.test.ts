import test from 'node:test';
import assert from 'node:assert/strict';
import { flightLinks } from './flights.ts';

test('aller-retour quand on repart de l\'aéroport d\'arrivée', () => {
  const l = flightLinks({ home: 'CDG', arrive: 'LIS', leave: 'LIS', start: '2026-10-30', end: '2026-11-02' });
  assert.equal(l.length, 1);
  assert.match(decodeURIComponent(l[0].url), /Flights from CDG to LIS on 2026-10-30 through 2026-11-02/);
});
test('deux allers simples si on repart d\'ailleurs', () => {
  const l = flightLinks({ home: 'CDG', arrive: 'HND', leave: 'KIX', start: '2026-10-14', end: '2026-10-21' });
  assert.equal(l.length, 2);
  assert.match(decodeURIComponent(l[1].url), /Flights from KIX to CDG on 2026-10-21/);
});
test('rien sans aéroport d\'arrivée', () => {
  assert.deepEqual(flightLinks({ home: 'CDG', arrive: null, leave: null, start: null, end: null }), []);
});
