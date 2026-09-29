import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify, popularity, closedDaysFromOpeningHours, elementToPlace, selectEssential,
  buildOverpassQuery, radiusForCity, GROUPS, CAPS,
} from '../src/lib/osm.mjs';

test('tri : services utiles (filtre Pratique)', () => {
  assert.deepEqual(classify({ amenity: 'pharmacy' }), { kind: 'service', category: 'pharmacie' });
  assert.deepEqual(classify({ amenity: 'bank' }), { kind: 'service', category: 'banque' });
  assert.deepEqual(classify({ amenity: 'atm' }), { kind: 'service', category: 'distributeur' });
  assert.deepEqual(classify({ amenity: 'hospital' }), { kind: 'service', category: 'hopital' });
  assert.deepEqual(classify({ amenity: 'toilets' }), { kind: 'service', category: 'toilettes' });
  assert.deepEqual(classify({ shop: 'laundry' }), { kind: 'service', category: 'laverie' });
});

test('tri : culture, nature, gastronomie, créatif, transports', () => {
  assert.equal(classify({ tourism: 'museum' }).category, 'musee');
  assert.equal(classify({ amenity: 'place_of_worship', religion: 'shinto' }).category, 'temple');
  assert.equal(classify({ amenity: 'place_of_worship', religion: 'christian' }).category, 'monument');
  assert.equal(classify({ historic: 'castle' }).category, 'monument');
  assert.equal(classify({ leisure: 'park' }).category, 'parc');
  assert.equal(classify({ natural: 'beach' }).category, 'plage');
  assert.equal(classify({ amenity: 'fast_food' }).category, 'street_food');
  assert.equal(classify({ craft: 'pottery' }).category, 'atelier');
  assert.equal(classify({ amenity: 'public_bath' }).category, 'spa');
  assert.deepEqual(classify({ railway: 'station', station: 'subway' }), { kind: 'transit', category: 'metro' });
  assert.deepEqual(classify({ railway: 'station' }), { kind: 'transit', category: 'gare' });
  assert.deepEqual(classify({ aeroway: 'aerodrome', iata: 'LIS' }), { kind: 'transit', category: 'aeroport' });
  assert.equal(classify({ aeroway: 'aerodrome' }), null, 'un aérodrome sans code IATA est ignoré');
  assert.deepEqual(classify({ tourism: 'hotel' }), { kind: 'lodging', category: 'hebergement' });
  assert.equal(classify({ highway: 'bus_stop' }), null);
});

test('chaque catégorie produite existe dans la migration place_categories', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../../supabase/migrations/20260929000200_reference_data.sql', import.meta.url), 'utf8');
  const codes = new Set([...sql.matchAll(/\('([a-z_]+)',\s*'(?:activity|service|lodging|transit)'/g)].map((m) => m[1]));
  const produced = new Set(Object.keys(CAPS));
  for (const c of produced) assert.ok(codes.has(c), `catégorie « ${c} » absente de place_categories`);
  const samples = [
    { amenity: 'pharmacy' }, { tourism: 'museum' }, { tourism: 'hotel' }, { railway: 'station' },
    { amenity: 'cinema' }, { leisure: 'amusement_arcade' }, { tourism: 'theme_park' }, { shop: 'mall' },
    { leisure: 'stadium' }, { amenity: 'nightclub' }, { amenity: 'marketplace' }, { tourism: 'viewpoint' }, { tourism: 'gallery' },
  ];
  for (const t of samples) assert.ok(codes.has(classify(t).category), JSON.stringify(t));
});

test('popularité : wikidata et sites web pèsent plus que rien', () => {
  assert.equal(popularity({}), 0);
  assert.ok(popularity({ wikidata: 'Q1', website: 'x', opening_hours: 'x' }) > popularity({ website: 'x' }));
});

test('horaires : jours de fermeture déduits seulement quand la règle est simple', () => {
  assert.deepEqual(closedDaysFromOpeningHours('Tu-Su 10:00-18:00'), [1]);
  assert.deepEqual(closedDaysFromOpeningHours('Mo-Sa 09:00-18:00'), [0]);
  assert.deepEqual(closedDaysFromOpeningHours('Mo-Fr 09:00-12:00,14:00-18:00'), [0, 6]);
  assert.deepEqual(closedDaysFromOpeningHours('Mo-Sa 09:00-18:00; We off'), [0, 3]);
  assert.deepEqual(closedDaysFromOpeningHours('Fr-Mo 10:00-20:00'), [2, 3, 4], 'plage qui passe la fin de semaine');
  assert.deepEqual(closedDaysFromOpeningHours('24/7'), []);
  assert.deepEqual(closedDaysFromOpeningHours('Mo-Su 08:00-20:00'), []);
  for (const complex of ['Mo-Fr 09:00-18:00; PH off', 'Mar-Oct Mo-Su 10:00-19:00', 'sunrise-sunset', 'Mo[1] 10:00-12:00', 'n\'importe quoi', '', null, undefined]) {
    assert.deepEqual(closedDaysFromOpeningHours(complex), [], String(complex));
  }
});

const node = (id, tags, extra = {}) => ({ type: 'node', id, lat: 38.7, lon: -9.1, tags, ...extra });

test('élément -> ligne places : nom, durée estimée, source et licence', () => {
  const row = elementToPlace(node(1, {
    tourism: 'museum', name: 'Museu Nacional do Azulejo', 'name:en': 'National Tile Museum',
    'addr:street': 'Rua da Madre de Deus', 'addr:housenumber': '4', 'addr:city': 'Lisboa',
    opening_hours: 'Tu-Su 10:00-18:00', wikidata: 'Q1', website: 'https://example.test',
  }), 42, { retrievedAt: 'T' });
  assert.equal(row.city_id, 42);
  assert.equal(row.kind, 'activity');
  assert.equal(row.category_code, 'musee');
  assert.equal(row.name, 'National Tile Museum');
  assert.equal(row.name_local, 'Museu Nacional do Azulejo');
  assert.equal(row.address, '4 Rua da Madre de Deus, Lisboa');
  assert.deepEqual(row.closed_days, [1]);
  assert.equal(row.visit_duration_min, 90);
  assert.equal(row.duration_is_estimate, true);
  assert.equal(row.osm_type, 'node');
  assert.equal(row.source, 'openstreetmap');
  assert.equal(row.license, 'ODbL 1.0');
  assert.equal(row.source_url, 'https://www.openstreetmap.org/node/1');
  for (const enriched of ['price_amount', 'description', 'google_place_id', 'cover_media_id']) {
    assert.ok(!(enriched in row), `${enriched} n'est pas écrasé par une nouvelle collecte`);
  }
});

test('élément -> ligne places : centre d\'une surface, services sans nom, éléments inutilisables', () => {
  const park = elementToPlace({ type: 'way', id: 7, center: { lat: 1, lon: 2 }, tags: { leisure: 'park', name: 'Jardim' } }, 1);
  assert.equal(park.lat, 1);
  assert.equal(park.lng, 2);
  const wc = elementToPlace(node(2, { amenity: 'toilets' }), 1);
  assert.equal(wc.name, 'Toilettes publiques');
  assert.equal(wc.visit_duration_min, null, 'pas de durée pour un service');
  assert.equal(elementToPlace(node(3, { amenity: 'restaurant' }), 1), null, 'restaurant sans nom ignoré');
  assert.equal(elementToPlace({ type: 'node', id: 4, tags: { amenity: 'atm' } }, 1), null, 'sans coordonnées ignoré');
  assert.equal(elementToPlace({ type: 'node', id: 5, lat: 1, lon: 1 }, 1), null, 'sans étiquettes ignoré');
});

test('garder l\'essentiel : doublons Wikidata, seuil de notoriété, plafond par catégorie', () => {
  const mk = (id, cat, popularityScore, extra = {}) => ({ osm_type: 'node', osm_id: id, category_code: cat, name: `L${id}`, popularity: popularityScore, wikidata_id: null, ...extra });
  const input = [
    mk(1, 'musee', 5, { wikidata_id: 'Q9' }), mk(2, 'musee', 3, { wikidata_id: 'Q9' }),   // même lieu, deux objets OSM
    mk(3, 'restaurant', 0), mk(4, 'restaurant', 2),                                         // 0 = trop peu de signaux
    ...Array.from({ length: 200 }, (_, i) => mk(100 + i, 'pharmacie', 0)),                  // plafond
  ];
  const kept = selectEssential(input);
  assert.deepEqual(kept.filter((p) => p.category_code === 'musee').map((p) => p.osm_id), [1]);
  assert.deepEqual(kept.filter((p) => p.category_code === 'restaurant').map((p) => p.osm_id), [4]);
  assert.equal(kept.filter((p) => p.category_code === 'pharmacie').length, CAPS.pharmacie);
});

test('requête Overpass : rayon, groupes, format', () => {
  assert.ok(radiusForCity(9_000_000) > radiusForCity(300_000));
  assert.ok(radiusForCity(300_000) > radiusForCity(20_000));
  for (const g of Object.keys(GROUPS)) {
    const q = buildOverpassQuery(g, { lat: 38.7223, lng: -9.1393, radiusM: 5000 });
    assert.match(q, /^\[out:json\]\[timeout:90\];/);
    assert.match(q, /out center tags;$/);
    assert.match(q, /around:\d+,38\.72230,-9\.13930/);
  }
  assert.match(buildOverpassQuery('services', { lat: 0, lng: 0, radiusM: 5000 }), /around:3000,/, 'les services sont cherchés plus près du centre');
  assert.throws(() => buildOverpassQuery('inconnu', { lat: 0, lng: 0, radiusM: 1 }), /inconnu/);
});
