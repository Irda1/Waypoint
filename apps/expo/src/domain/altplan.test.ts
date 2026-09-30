import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAltPlan } from './altplan.ts';

const stop = (itemId: string, root: string, durationMin: number, travelMin = 0) => ({ itemId, root, durationMin, travelMin });

test('plan allégé : garde les repas, retire les visites les plus lourdes, ~60 % des étapes', () => {
  const stops = [stop('a', 'culture', 180), stop('b', 'gastronomie', 60), stop('c', 'culture', 45, 10), stop('d', 'nature', 120, 30), stop('e', 'culture', 60)];
  // 5 étapes → on en garde 3, donc on retire les 2 plus lourdes : a (180) et d (150).
  assert.deepEqual(deriveAltPlan('light', stops), ['b', 'c', 'e']);
});

test('plan allégé : une seule étape reste, un repas n\'est jamais retiré', () => {
  assert.deepEqual(deriveAltPlan('light', [stop('a', 'culture', 60)]), ['a']);
  assert.deepEqual(deriveAltPlan('light', [stop('m', 'gastronomie', 200), stop('v', 'culture', 300), stop('w', 'culture', 30)]), ['m', 'w']);
});

test('plan à l\'abri : retire nature et sport, garde le reste dans l\'ordre', () => {
  const stops = [stop('a', 'nature', 90), stop('b', 'culture', 60), stop('c', 'sport', 60), stop('d', 'gastronomie', 60)];
  assert.deepEqual(deriveAltPlan('shelter', stops), ['b', 'd']);
  assert.deepEqual(deriveAltPlan('shelter', [stop('a', 'nature', 90)]), []);
});
