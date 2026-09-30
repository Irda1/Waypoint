import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOpening, parseOpeningHours } from './openingHours.ts';

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
