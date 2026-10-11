import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateFlight, flightLinks, flightMinutes, googleFlightsUrl } from './flights.ts';

const tfsOf = (url: string) => Buffer.from(new URL(url).searchParams.get('tfs')!, 'base64url').toString('latin1');
const plan = { home: 'Paris', homeIata: 'CDG', start: '2026-10-30', end: '2026-11-02', adults: 3 };

test('lien Google Flights : même encodage que les adresses de Google Flights (trajets, passagers, éco, aller-retour)', () => {
  const url = googleFlightsUrl([{ date: '2026-11-05', from: 'CDG', to: 'NRT' }, { date: '2026-11-19', from: 'NRT', to: 'CDG' }], 3);
  assert.equal(new URL(url).searchParams.get('tfs'), 'GhoSCjIwMjYtMTEtMDVqBRIDQ0RHcgUSA05SVBoaEgoyMDI2LTExLTE5agUSA05SVHIFEgNDREdAAUABQAFIAZgBAQ');
});
test('aller-retour quand on repart de l\'aéroport d\'arrivée, avec les voyageurs', () => {
  const l = flightLinks({ ...plan, arrive: { name: 'Lisbonne', iata: 'LIS' }, leave: { name: 'Lisbonne', iata: 'LIS' } });
  assert.equal(l.length, 1);
  const t = tfsOf(l[0].url);
  assert.ok(t.includes('CDG') && t.includes('LIS') && t.includes('2026-10-30') && t.includes('2026-11-02'));
  assert.equal(t.split('@\u0001').length - 1, 3);
  assert.match(l[0].label, /3 voyageurs/);
});
test('deux allers simples si on repart d\'ailleurs', () => {
  const l = flightLinks({ ...plan, arrive: { name: 'Tokyo', iata: 'HND' }, leave: { name: 'Osaka', iata: 'KIX' } });
  assert.equal(l.length, 2);
  const t = tfsOf(l[1].url);
  assert.ok(t.includes('KIX') && t.includes('CDG') && t.includes('2026-11-02'));
});
test('aller simple : un seul vol, même si on repart du même aéroport', () => {
  const l = flightLinks({ ...plan, oneWay: true, arrive: { name: 'Lisbonne', iata: 'LIS' }, leave: { name: 'Lisbonne', iata: 'LIS' } });
  assert.equal(l.length, 1);
  assert.match(l[0].label, /^Aller Paris \(CDG\) → Lisbonne \(LIS\)/);
  assert.ok(!tfsOf(l[0].url).includes('2026-11-02'));
});
test('rien sans aéroport d\'arrivée', () => {
  assert.deepEqual(flightLinks({ ...plan, arrive: null, leave: null }), []);
});
test('durée de vol estimée', () => {
  assert.equal(flightMinutes(780, false), 100);
  assert.ok(flightMinutes(9700, true) > flightMinutes(9700, false));
});

test('estimation de vol : court trajet direct, long trajet avec escale moins chère', () => {
  const short = estimateFlight(500);
  assert.equal(short.stopover, false);
  assert.equal(short.cheapest, short.direct);
  const long = estimateFlight(9700);
  assert.equal(long.stopover, true);
  assert.ok(long.cheapest < long.direct && long.direct > 500 && long.direct < 800, JSON.stringify(long));
});
