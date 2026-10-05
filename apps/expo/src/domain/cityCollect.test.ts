import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFastQuery, collectCityPlaces, geoapifyToElement, hedgedOverpass, toPayload } from './cityCollect.ts';
import { buildOverpassQuery } from './osm.ts';

test('osm.ts est une copie exacte de pipeline/src/lib/osm.mjs', () => {
  const copy = readFileSync(new URL('./osm.ts', import.meta.url), 'utf8').split('\n').slice(1).join('\n');
  const original = readFileSync(new URL('../../../../pipeline/src/lib/osm.mjs', import.meta.url), 'utf8');
  assert.equal(copy, original);
});

const args = { lat: 35.01, lng: 135.76, radiusM: 5000 };

test('requête rapide : les restaurants ne sont demandés que s\'ils ont un signal de notoriété', () => {
  const q = buildFastQuery('food', args);
  assert.match(q, /nwr\["amenity"~"\^\(restaurant[^"]*"\]\["name"\]\["website"\]\(around:/);
  assert.match(q, /\["opening_hours"\]/);
  assert.match(q, /\["wikidata"\]/);
  assert.match(q, /out center tags 1500;$/);
});

test('requête rapide : les attractions gardent les mêmes sélecteurs que le pipeline, avec une limite', () => {
  const fast = buildFastQuery('attractions', args);
  const base = buildOverpassQuery('attractions', { ...args, timeoutS: 40 });
  assert.equal(fast, base.replace(/out center tags;$/, 'out center tags 3000;'));
});

test('requête rapide : les services sont limités à 400 éléments', () => {
  assert.match(buildFastQuery('services', args), /out center tags 400;$/);
});

const ok = (elements: unknown[]) => Promise.resolve({ ok: true, status: 200, json: async () => ({ elements }) });
const err = (status: number) => Promise.resolve({ ok: false, status, json: async () => ({}) });

test('serveur surchargé : on passe tout de suite au suivant', async () => {
  const seen: string[] = [];
  const els = await hedgedOverpass('q', {
    mirrors: ['a', 'b', 'c'], hedgeMs: 10_000,
    fetchImpl: (url) => { seen.push(url); return url === 'a' ? err(504) : ok([{ type: 'node', id: 1 }]); },
  });
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(els.length, 1);
});

test('serveur trop lent : le suivant est lancé en renfort et la première réponse gagne', async () => {
  let aborted = false;
  const els = await hedgedOverpass('q', {
    mirrors: ['a', 'b'], hedgeMs: 20,
    fetchImpl: (url, init) => (url === 'a'
      ? new Promise((_res, rej) => init.signal.addEventListener('abort', () => { aborted = true; rej(new Error('abort')); }))
      : ok([{ type: 'node', id: 2 }])),
  });
  assert.equal(els[0].id, 2);
  assert.equal(aborted, true, 'la requête perdante est annulée');
});

test('la remarque « runtime error » d\'Overpass compte comme un échec', async () => {
  await assert.rejects(hedgedOverpass('q', {
    mirrors: ['a'], fetchImpl: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ elements: [], remark: 'runtime error: Query timed out' }) }),
  }), /timed out/);
});

test('tous les serveurs en échec : rejet', async () => {
  await assert.rejects(hedgedOverpass('q', { mirrors: ['a', 'b'], hedgeMs: 5, fetchImpl: () => err(429) }), /429/);
});

const museum = { type: 'node', id: 10, lat: 35.011, lon: 135.768, tags: { tourism: 'museum', name: 'Musée', wikidata: 'Q1' } };
const diner = { type: 'node', id: 11, lat: 35.012, lon: 135.769, tags: { amenity: 'restaurant', name: 'Chez Lui', website: 'https://x.test' } };
const obscure = { type: 'node', id: 12, lat: 35.013, lon: 135.77, tags: { amenity: 'restaurant', name: 'Sans signal' } };
const city = { id: 7, lat: 35.01, lng: 135.76, population: 1_400_000 };

test('collecte d\'une ville : tri identique au pipeline, progression par groupe, charge utile minimale', async () => {
  const steps: number[] = [];
  const r = await collectCityPlaces(city, {
    mirrors: ['a'], retryDelayMs: 1,
    fetchImpl: (_u, init) => {
      const q = decodeURIComponent(init.body.slice(5));
      return ok(q.includes('tourism') ? [museum] : q.includes('restaurant') ? [diner, obscure] : []);
    },
    onGroup: (d) => steps.push(d),
  });
  assert.deepEqual(steps, [1, 2, 3, 4]);
  assert.deepEqual(r.rows.map((x) => x.name).sort(), ['Chez Lui', 'Musée']);
  const first = r.rows[0];
  assert.ok(!('city_id' in first) && !('status' in first) && !('source' in first));
  assert.equal(first.osm_type, 'node');
});

test('collecte : un groupe secondaire en échec ne bloque pas, les attractions en échec bloquent', async () => {
  const run = (failing: string) => collectCityPlaces(city, {
    mirrors: ['a'], retryDelayMs: 1,
    fetchImpl: (_u, init) => {
      const q = decodeURIComponent(init.body.slice(5));
      if (q.includes(failing)) return err(504);
      return ok(q.includes('tourism') ? [museum] : []);
    },
  });
  const r = await run('amenity"~"^(pharmacy');
  assert.deepEqual(r.failedGroups, ['services']);
  await assert.rejects(run('museum|gallery'), /lieux à visiter/);
});

test('charge utile : ne garde que les champs acceptés par la base', () => {
  assert.deepEqual(toPayload({ name: 'A', city_id: 3, status: 'active', phone: null, osm_id: 4 }), { name: 'A', osm_id: 4 });
});

const geoMuseum = { properties: { name: 'Musée', lat: 35.011, lon: 135.768, datasource: { raw: { osm_type: 'n', osm_id: 10, tourism: 'museum', name: 'Musée', wikidata: 'Q1' } } } };

test('Geoapify : un lieu devient un élément OSM ; sans identifiant OSM il est ignoré', () => {
  assert.deepEqual(geoapifyToElement(geoMuseum), museum);
  assert.equal(geoapifyToElement({ properties: { lat: 1, lon: 2, datasource: { raw: { tourism: 'museum' } } } }), null);
});

test('collecte avec clé Geoapify : sans Overpass quand Geoapify répond, repli Overpass pour un groupe vide', async () => {
  const urls: string[] = [];
  const r = await collectCityPlaces(city, {
    mirrors: ['a'], retryDelayMs: 1, geoapifyKey: 'K',
    geoFetch: (u) => { urls.push(u); return Promise.resolve({ ok: true, status: 200, json: async () => ({ features: u.includes('categories=tourism') ? [geoMuseum] : [] }) }); },
    fetchImpl: (_u, init) => ok(decodeURIComponent(init.body.slice(5)).includes('restaurant') ? [diner] : []),
  });
  assert.equal(urls.length, 4);
  assert.match(urls[0], /filter=circle:135\.76,35\.01,\d+&.*limit=500&apiKey=K$/);
  assert.deepEqual(r.rows.map((x) => x.name).sort(), ['Chez Lui', 'Musée']);
});

test('collecte : Geoapify en erreur, tout retombe sur Overpass', async () => {
  const r = await collectCityPlaces(city, {
    mirrors: ['a'], retryDelayMs: 1, geoapifyKey: 'K',
    geoFetch: () => Promise.resolve({ ok: false, status: 429, json: async () => ({}) }),
    fetchImpl: (_u, init) => ok(decodeURIComponent(init.body.slice(5)).includes('tourism') ? [museum] : []),
  });
  assert.deepEqual(r.rows.map((x) => x.name), ['Musée']);
});
