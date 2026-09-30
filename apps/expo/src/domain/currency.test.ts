import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRateTable, convert, EMPTY_RATES, formatApprox } from './currency.ts';

const table = buildRateTable([
  { quote: 'USD', rate: '1.1355', rate_date: '2026-09-29' },
  { quote: 'JPY', rate: 178.41, rate_date: '2026-09-29' },
  { quote: 'XXX', rate: 0, rate_date: '2026-09-28' },
]);

test('table de taux : EUR vaut 1, taux nul ignoré, date la plus récente', () => {
  assert.equal(table.rates.EUR, 1);
  assert.equal(table.rates.USD, 1.1355);
  assert.equal('XXX' in table.rates, false);
  assert.equal(table.date, '2026-09-29');
});

test('conversion via l\'euro, et aller-retour cohérent', () => {
  assert.equal(convert(100, 'EUR', 'JPY', table), 17841);
  assert.ok(Math.abs(convert(convert(50, 'USD', 'JPY', table)!, 'JPY', 'USD', table)! - 50) < 1e-9);
  assert.equal(convert(10, 'EUR', 'EUR', EMPTY_RATES), 10);
});

test('devise inconnue : pas de taux inventé', () => {
  assert.equal(convert(10, 'EUR', 'ZZZ', table), null);
  assert.equal(convert(10, 'EUR', 'JPY', EMPTY_RATES), null);
});

test('montant estimé marqué « ≈ »', () => {
  assert.match(formatApprox(17841, 'JPY'), /^≈ /);
});
