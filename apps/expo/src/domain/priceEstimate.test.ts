import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePrice, withEstimatedPrice } from './priceEstimate.ts';

test('estimation par catégorie', () => {
  assert.equal(estimatePrice('musee'), 10);
  assert.equal(estimatePrice('parc'), 0);
  assert.equal(estimatePrice('inconnue'), null);
});
test('un prix réel reste prioritaire', () => {
  const p = { kind: 'activity', category_code: 'musee', price_amount: 7 };
  assert.equal(withEstimatedPrice(p).price_amount, 7);
  assert.equal(withEstimatedPrice({ ...p, price_amount: null }).price_amount, 10);
  assert.equal(withEstimatedPrice({ kind: 'lodging', category_code: 'musee', price_amount: null }).price_amount, null);
});
