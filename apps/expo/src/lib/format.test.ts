import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, formatMoney, isIsoDate, isTime, parseAmount } from './format.ts';

test('saisies : montants avec virgule ou point, refus des valeurs invalides', () => {
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('12.50'), 12.5);
  assert.equal(parseAmount(' 0 '), 0);
  for (const bad of ['', 'abc', '-3', '1,2,3']) assert.equal(parseAmount(bad), null, bad);
});

test('saisies : dates et heures', () => {
  assert.ok(isIsoDate('2026-10-13'));
  assert.ok(!isIsoDate('13/10/2026'));
  assert.ok(!isIsoDate('2026-13-45'));
  assert.ok(isTime('09:30') && isTime('23:59'));
  assert.ok(!isTime('24:00') && !isTime('9:30') && !isTime('09h30'));
});

test('jour lisible, sans décalage de fuseau', () => {
  assert.match(formatDay('2026-10-13'), /mardi 13 octobre/);
});

test('montants : toujours en nombres entiers, sans décimales', () => {
  const norm = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ');
  assert.equal(norm(formatMoney(0, 'EUR')), '0 €');
  assert.equal(norm(formatMoney(400, 'EUR')), '400 €');
  assert.equal(norm(formatMoney(12.5, 'EUR')), '13 €');
  assert.equal(norm(formatMoney(2525, 'EUR')), '2 525 €');
});
