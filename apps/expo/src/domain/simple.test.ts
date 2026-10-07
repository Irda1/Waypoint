import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPlaces, mapsUrl, openingToday, selectionBudget } from './simple.ts';
import type { SimplePlace } from './simple.ts';

const mk = (id: number, city: number, code: string, price: number | null, extra: Partial<SimplePlace> = {}): SimplePlace =>
  ({ id, city_id: city, name: `P${id}`, category_code: code, lat: 48.8, lng: 2.3, price_amount: price, visit_duration_min: 60, closed_days: [], opening_hours: null, popularity: 1, ...extra });
const rootOf = (c: string) => (c === 'musee' ? 'culture' : 'gastronomie');

test('lien Google Maps : nom encodé, centré sur le lieu', () => {
  assert.equal(mapsUrl({ name: 'Café du Pont', lat: 1.5, lng: 2.5 }), 'https://www.google.com/maps/search/Caf%C3%A9%20du%20Pont/@1.5,2.5,17z');
});

test('horaires du jour : fermé, ouvert avec créneaux, inconnu', () => {
  const monday = '2026-12-14'; // lundi
  assert.equal(openingToday(mk(1, 1, 'musee', 5, { closed_days: [1] }), monday), 'Fermé le lundi');
  assert.equal(openingToday(mk(1, 1, 'musee', 5, { opening_hours: 'Mo-Fr 09:00-18:00' }), monday), 'Ouvert 09:00–18:00');
  assert.equal(openingToday(mk(1, 1, 'musee', 5), monday), null);
});

test('filtre par ville et par catégorie', () => {
  const ps = [mk(1, 1, 'musee', 10), mk(2, 1, 'resto', 20), mk(3, 2, 'musee', 5)];
  assert.deepEqual(filterPlaces(ps, { cityId: 1, root: null }, rootOf).map((p) => p.id), [1, 2]);
  assert.deepEqual(filterPlaces(ps, { cityId: null, root: 'culture' }, rootOf).map((p) => p.id), [1, 3]);
  assert.equal(filterPlaces(ps, { cityId: null, root: null }, rootOf).length, 3);
});

test('budget de la sélection : total du groupe, par personne, sans prix compté à part', () => {
  const b = selectionBudget([mk(1, 1, 'musee', 12.5), mk(2, 1, 'resto', 30), mk(3, 1, 'musee', null)], 3, rootOf);
  assert.equal(b.perPerson, 42.5);
  assert.equal(b.total, 127.5);
  assert.equal(b.unpriced, 1);
  assert.deepEqual(b.byRoot.map((r) => [r.root, r.amount, r.count]), [['gastronomie', 90, 1], ['culture', 37.5, 1]]);
});
