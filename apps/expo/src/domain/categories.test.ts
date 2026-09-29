import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCategories } from '../domain/categories.ts';

const rows = [
  { code: 'culture', kind: 'activity', parent_code: null, name_fr: 'Culture', sort_order: 10 },
  { code: 'musee', kind: 'activity', parent_code: 'culture', name_fr: 'Musées', sort_order: 11 },
  { code: 'gastronomie', kind: 'activity', parent_code: null, name_fr: 'Gastronomie', sort_order: 20 },
  { code: 'pharmacie', kind: 'service', parent_code: null, name_fr: 'Pharmacies', sort_order: 90 },
];

test('catégories : remonte à la catégorie principale', () => {
  const c = buildCategories(rows);
  assert.equal(c.rootOf('musee'), 'culture');
  assert.equal(c.rootOf('culture'), 'culture');
  assert.equal(c.rootOf(null), '');
});

test('catégories : la famille contient la principale et ses sous-catégories', () => {
  const c = buildCategories(rows);
  assert.deepEqual(c.familyOf('culture').sort(), ['culture', 'musee']);
  assert.deepEqual(c.familyOf('gastronomie'), ['gastronomie']);
});

test('catégories : seules les activités principales servent de filtres, dans l\'ordre', () => {
  const c = buildCategories(rows);
  assert.deepEqual(c.activityRoots.map((r) => r.code), ['culture', 'gastronomie']);
});
