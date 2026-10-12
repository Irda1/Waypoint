import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOpening, formatHour, openNow, parseOpeningHours, weekLines } from './openingHours.ts';

test('lecture des horaires courants', () => {
  const w = parseOpeningHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off')!;
  assert.deepEqual(w[1], [[540, 1080]]);
  assert.deepEqual(w[6], [[600, 840]]);
  assert.deepEqual(w[0], []);
  assert.deepEqual(parseOpeningHours('Mo-Su 09:00-13:00,14:00-18:00')![3], [[540, 780], [840, 1080]]);
  assert.equal(parseOpeningHours('24/7')![2][0][1], 1440);
  assert.equal(parseOpeningHours('sunrise-sunset'), null);
  assert.equal(parseOpeningHours(null), null);
});

test('vérification d\'une visite', () => {
  const h = 'Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off';
  assert.deepEqual(checkOpening(h, [], 1, 600, 660), { status: 'ok' });
  assert.deepEqual(checkOpening(h, [], 0, 600, 660), { status: 'closed', day: 'dimanche' });
  assert.deepEqual(checkOpening(h, [], 1, 480, 540), { status: 'outside', slots: [[540, 1080]] });
  assert.deepEqual(checkOpening(h, [], 1, 1000, 1100), { status: 'outside', slots: [[540, 1080]] });
  assert.deepEqual(checkOpening(null, [], 1, 600, 660), { status: 'unknown' });
  assert.deepEqual(checkOpening(null, [1], 1, 600, 660), { status: 'closed', day: 'lundi' });
  assert.deepEqual(checkOpening(h, [], 1, null, null), { status: 'ok' });
});

test('ouvert maintenant : texte et ton de la fiche', () => {
  // 2026-10-13 est un mardi
  const at = (h: number, m = 0) => new Date(2026, 9, 13, h, m);
  const H = 'Mo-Fr 09:00-17:30; Sa 10:00-14:00; Su off';
  assert.deepEqual(openNow(H, [], at(10)), { tone: 'ok', text: 'Ouvert · ferme à 17 h 30' });
  assert.deepEqual(openNow(H, [], at(8)), { tone: 'warn', text: 'Fermé · ouvre à 9 h' });
  assert.deepEqual(openNow(H, [], at(18)), { tone: 'warn', text: 'Fermé · ouvre demain à 9 h' });
  assert.deepEqual(openNow('Sa 10:00-14:00', [], at(18)), { tone: 'none', text: 'Horaires non renseignés' }, 'mardi absent du texte');
  assert.deepEqual(openNow('Mo-Su 18:00-02:00', [], new Date(2026, 9, 14, 1)), { tone: 'ok', text: 'Ouvert · ferme à 2 h' }, 'ouvert depuis la veille');
  assert.deepEqual(openNow('24/7', [], at(3)), { tone: 'ok', text: 'Ouvert 24 h/24' });
  assert.deepEqual(openNow(null, [2], at(10)), { tone: 'warn', text: 'Fermé aujourd\'hui' });
  assert.deepEqual(openNow(null, [], at(10)), { tone: 'none', text: 'Horaires non renseignés' });
  assert.equal(formatHour(1500), '1 h');
});

test('horaires de la semaine, du lundi au dimanche', () => {
  const w = weekLines('Mo-Fr 09:00-12:00,14:00-18:00; Sa 10:00-14:00; Su off')!;
  assert.deepEqual(w.map((l) => l.day), ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
  assert.equal(w[0].text, '9 h – 12 h, 14 h – 18 h');
  assert.equal(w[6].text, 'Fermé');
  assert.equal(weekLines('24/7')![3].text, '24 h/24');
  assert.equal(weekLines('n\'importe quoi'), null);
});
