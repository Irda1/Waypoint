import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSupabase } from '../src/lib/supabase.mjs';
import { loadConfig } from '../src/lib/config.mjs';
import { countriesPass } from '../src/passes/countries.mjs';
import { citiesPass } from '../src/passes/cities.mjs';
import { placesPass } from '../src/passes/places.mjs';
import { imagesPass, photoToMedia } from '../src/passes/images.mjs';
import { queuePass } from '../src/passes/queue.mjs';
import { parseRates, ratesPass } from '../src/passes/rates.mjs';
import { Throttle } from '../src/lib/http.mjs';
import { startFakeSupabase, silent } from './helpers.mjs';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const cfg = loadConfig({ SUPABASE_URL: 'http://unused', SUPABASE_SERVICE_ROLE_KEY: 'K', PEXELS_API_KEY: 'PX', OVERPASS_INTERVAL_MS: '0', PEXELS_INTERVAL_MS: '0' });
const noWait = () => new Throttle(0);

test('passe pays : écrit 3 pays et journalise la passe', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const stats = await countriesPass({ sb, cfg, file: fx('countryInfo.txt'), log: silent });
    assert.equal(stats.kept, 3);
    const paths = fake.calls.map((c) => `${c.method} ${c.path}`);
    assert.deepEqual(paths, ['POST /rest/v1/ingestion_runs', 'POST /rest/v1/countries', 'PATCH /rest/v1/ingestion_runs']);
    assert.equal(fake.calls[1].body.length, 3);
    assert.equal(fake.calls[1].query.on_conflict, 'code');
    assert.equal(fake.calls[2].body.status, 'done');
    assert.equal(fake.calls[2].body.rows_written, 3);
  } finally { await fake.close(); }
});

test('passe villes : depuis le zip, ignore les pays absents, écrit par geonames_id', async () => {
  const fake = await startFakeSupabase({ onRequest: (c) => (c.method === 'GET' && c.path.endsWith('/countries') ? { body: [{ code: 'PT' }, { code: 'JP' }] } : null) });
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const stats = await citiesPass({ sb, cfg, file: fx('cities15000.zip'), admin1File: fx('admin1CodesASCII.txt'), log: silent });
    assert.equal(stats.kept, 3);
    const write = fake.calls.find((c) => c.method === 'POST' && c.path.endsWith('/cities'));
    assert.equal(write.query.on_conflict, 'geonames_id');
    assert.deepEqual(write.body.map((r) => r.name), ['Lisbon', 'Porto', 'Tokyo']);
  } finally { await fake.close(); }
});

test('passe villes : refuse de tourner sans pays en base', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    await assert.rejects(() => citiesPass({ sb, cfg, file: fx('cities15000.txt'), admin1File: fx('admin1CodesASCII.txt'), log: silent }), /countries/);
    const last = fake.calls.at(-1);
    assert.equal(last.method, 'PATCH');
    assert.equal(last.body.status, 'failed');
  } finally { await fake.close(); }
});

// --- Overpass simulé : une réponse par groupe de requêtes -------------------
const overpass = {
  attractions: [
    { type: 'node', id: 1, lat: 38.7, lon: -9.1, tags: { tourism: 'museum', name: 'Museu do Azulejo', wikidata: 'Q1', opening_hours: 'Tu-Su 10:00-18:00' } },
    { type: 'way', id: 2, center: { lat: 38.71, lon: -9.14 }, tags: { amenity: 'place_of_worship', religion: 'christian', name: 'Sé de Lisboa', wikidata: 'Q2' } },
    { type: 'node', id: 3, lat: 38.7, lon: -9.1, tags: { craft: 'pottery', name: 'Atelier Azulejo' } },
  ],
  food: [
    { type: 'node', id: 4, lat: 38.7, lon: -9.1, tags: { amenity: 'restaurant', name: 'Cervejaria', website: 'x', opening_hours: 'Mo-Su 12:00-23:00' } },
    { type: 'node', id: 5, lat: 38.7, lon: -9.1, tags: { amenity: 'restaurant', name: 'Sans signal' } },
  ],
  services: [
    { type: 'node', id: 6, lat: 38.7, lon: -9.1, tags: { amenity: 'pharmacy', name: 'Farmácia Chiado' } },
    { type: 'node', id: 7, lat: 38.7, lon: -9.1, tags: { amenity: 'toilets' } },
  ],
  stays_transit: [
    { type: 'node', id: 8, lat: 38.7, lon: -9.1, tags: { tourism: 'hotel', name: 'Hotel do Chiado', website: 'x', stars: '4' } },
    { type: 'node', id: 9, lat: 38.7, lon: -9.1, tags: { railway: 'station', station: 'subway', name: 'Baixa-Chiado' } },
  ],
};

function overpassFetch({ failGroups = [], log = [] } = {}) {
  return async (url, init) => {
    const query = decodeURIComponent(String(init.body).replace(/^data=/, ''));
    const group = Object.keys(overpass).find((g) => (
      (g === 'attractions' && query.includes('museum|gallery')) || (g === 'food' && query.includes('restaurant|cafe'))
      || (g === 'services' && query.includes('pharmacy|bank')) || (g === 'stays_transit' && query.includes('hotel|hostel'))
    ));
    log.push(group);
    if (failGroups.includes(group)) return new Response('overloaded', { status: 400 });
    return new Response(JSON.stringify({ elements: overpass[group] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const lisbon = { id: 5, name: 'Lisbonne', lat: 38.7223, lng: -9.1393, population: 517802 };

test('passe lieux : collecte, tri, écriture des lieux, provenance, statut de la ville', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const seen = [];
    const stats = await placesPass({ sb, cfg, city: lisbon, fetchImpl: overpassFetch({ log: seen }), throttle: noWait(), log: silent });
    assert.deepEqual(seen.sort(), ['attractions', 'food', 'services', 'stays_transit']);
    assert.equal(stats.read, 9);
    assert.equal(stats.kept, 8, 'le restaurant sans aucun signal est écarté');

    const placesCall = fake.calls.find((c) => c.method === 'POST' && c.path.endsWith('/places'));
    assert.equal(placesCall.query.on_conflict, 'osm_type,osm_id');
    const byOsm = Object.fromEntries(placesCall.body.map((p) => [p.osm_id, p]));
    assert.equal(byOsm[1].category_code, 'musee');
    assert.deepEqual(byOsm[1].closed_days, [1]);
    assert.equal(byOsm[2].category_code, 'monument');
    assert.equal(byOsm[6].kind, 'service');
    assert.equal(byOsm[7].name, 'Toilettes publiques');
    assert.equal(byOsm[9].category_code, 'metro');
    assert.ok(placesCall.body.every((p) => p.city_id === 5 && p.license === 'ODbL 1.0' && p.source === 'openstreetmap'));

    const src = fake.calls.find((c) => c.method === 'POST' && c.path.endsWith('/place_sources'));
    assert.equal(src.body.length, 8);
    assert.equal(src.query.on_conflict, 'place_id,source');
    assert.ok(src.body.every((s) => s.license_risk === 'ok' && typeof s.place_id === 'number'));

    const cityPatches = fake.calls.filter((c) => c.method === 'PATCH' && c.path.endsWith('/cities')).map((c) => c.body.collection_status);
    assert.deepEqual(cityPatches, ['collecting', 'ready']);
    const run = fake.calls.at(-1);
    assert.equal(run.path, '/rest/v1/ingestion_runs');
    assert.equal(run.body.status, 'done');
  } finally { await fake.close(); }
});

test('passe lieux : un groupe en panne n\'empêche pas les autres et est signalé', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const stats = await placesPass({ sb, cfg, city: lisbon, fetchImpl: overpassFetch({ failGroups: ['food'] }), throttle: noWait(), log: silent });
    assert.deepEqual(stats.failedGroups, ['food']);
    assert.ok(stats.kept > 0);
    const run = fake.calls.at(-1);
    assert.equal(run.body.status, 'failed');
    assert.match(run.body.error, /food/);
  } finally { await fake.close(); }
});

test('passe lieux : panne totale = ville marquée « failed », rien d\'écrit', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    await assert.rejects(() => placesPass({ sb, cfg, city: lisbon, fetchImpl: overpassFetch({ failGroups: Object.keys(overpass) }), throttle: noWait(), log: silent }), /injoignable/);
    assert.ok(!fake.calls.some((c) => c.path.endsWith('/places')));
    const statuses = fake.calls.filter((c) => c.method === 'PATCH' && c.path.endsWith('/cities')).map((c) => c.body.collection_status);
    assert.deepEqual(statuses, ['collecting', 'failed']);
  } finally { await fake.close(); }
});

test('passe lieux : en simulation, aucune écriture', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K', dryRun: true, log: silent });
    const stats = await placesPass({ sb, cfg, city: lisbon, fetchImpl: overpassFetch(), throttle: noWait(), log: silent });
    assert.equal(stats.kept, 8);
    assert.equal(fake.calls.length, 0);
  } finally { await fake.close(); }
});

test('file de collecte : prend une tâche, remplit la ville, la marque terminée', async () => {
  let claimed = 0;
  const fake = await startFakeSupabase({
    onRequest: (c) => {
      if (c.path.endsWith('/rpc/claim_collection_job')) return { body: claimed++ === 0 ? [{ id: 9, city_id: 5, attempts: 1 }] : [] };
      if (c.method === 'GET' && c.path.endsWith('/cities')) return { body: [lisbon] };
      return null;
    },
  });
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const summary = await queuePass({ sb, cfg, max: 3, fetchImpl: overpassFetch(), throttle: noWait(), log: silent });
    assert.deepEqual(summary, { done: 1, failed: 0 });
    const queuePatch = fake.calls.find((c) => c.method === 'PATCH' && c.path.endsWith('/ingestion_queue'));
    assert.equal(queuePatch.query.id, 'eq.9');
    assert.equal(queuePatch.body.status, 'done');
  } finally { await fake.close(); }
});

test('file de collecte : échec = nouvelle tentative, puis abandon à la 3e', async () => {
  const run = async (attempts) => {
    let claimed = 0;
    const fake = await startFakeSupabase({
      onRequest: (c) => {
        if (c.path.endsWith('/rpc/claim_collection_job')) return { body: claimed++ === 0 ? [{ id: 9, city_id: 5, attempts }] : [] };
        if (c.method === 'GET' && c.path.endsWith('/cities')) return { body: [lisbon] };
        return null;
      },
    });
    try {
      const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
      const summary = await queuePass({ sb, cfg, max: 2, fetchImpl: overpassFetch({ failGroups: Object.keys(overpass) }), throttle: noWait(), log: silent });
      assert.equal(summary.failed, 1);
      return fake.calls.find((c) => c.method === 'PATCH' && c.path.endsWith('/ingestion_queue')).body.status;
    } finally { await fake.close(); }
  };
  assert.equal(await run(1), 'queued');
  assert.equal(await run(3), 'failed');
});

test('images Pexels : crédit du photographe, lien, cover de la ville, arrêt sur quota bas', async () => {
  const fake = await startFakeSupabase({
    onRequest: (c) => (c.method === 'GET' && c.path.endsWith('/cities')
      ? { body: [{ id: 1, name: 'Lisboa', countries: { name_en: 'Portugal' } }, { id: 2, name: 'Porto', countries: { name_en: 'Portugal' } }] } : null),
  });
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const photo = { id: 555, url: 'https://www.pexels.com/photo/555/', photographer: 'Ana', photographer_url: 'https://www.pexels.com/@ana', avg_color: '#AA8866', width: 4000, height: 3000, src: { small: 's', medium: 'm', large: 'l', large2x: 'l2' } };
    const sent = [];
    const fetchImpl = async (url, init) => {
      sent.push({ url, auth: init.headers.Authorization });
      return new Response(JSON.stringify({ photos: [photo] }), { status: 200, headers: { 'x-ratelimit-remaining': '3' } });
    };
    const stats = await imagesPass({ sb, cfg, max: 5, country: 'pt', fetchImpl, throttle: noWait(), log: silent });
    assert.equal(sent.length, 1, 'quota presque atteint : arrêt propre après la première ville');
    assert.equal(sent[0].auth, 'PX');
    assert.match(fake.calls.find((c) => c.method === 'GET' && c.path.endsWith('/cities')).query.country_code, /eq\.PT/);
    assert.match(sent[0].url, /query=Lisboa%20Portugal%20city/);
    assert.equal(stats.kept, 1);
    const media = fake.calls.find((c) => c.path.endsWith('/media'));
    assert.equal(media.body[0].attribution, 'Photo : Ana / Pexels');
    assert.equal(media.body[0].page_url, 'https://www.pexels.com/photo/555/');
    const patch = fake.calls.find((c) => c.method === 'PATCH' && c.path.endsWith('/cities'));
    assert.equal(patch.query.id, 'eq.1');
    assert.ok(patch.body.cover_media_id);
  } finally { await fake.close(); }
  assert.equal(photoToMedia(photo0()).url_large, 'L');
  function photo0() { return { id: 1, src: { large: 'L' } }; }
});

test('images : sans clé Pexels, message clair', async () => {
  await assert.rejects(() => imagesPass({ sb: {}, cfg: { ...cfg, pexelsKey: '' }, log: silent }), /PEXELS_API_KEY/);
});

const RATES = { amount: 1, base: 'EUR', date: '2026-09-29', rates: { USD: 1.1355, JPY: 178.41, GBP: 0.86, CHF: 0.94, CAD: 1.55, AUD: 1.7, SEK: 11, NOK: 11.5, PLN: 4.3, CZK: 25 } };

test('taux de change : analyse la réponse et refuse une réponse incomplète', () => {
  const rows = parseRates(RATES);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], { base: 'EUR', quote: 'USD', rate: 1.1355, rate_date: '2026-09-29' });
  assert.throws(() => parseRates({ ...RATES, base: 'USD' }), /inattendue/);
  assert.throws(() => parseRates({ base: 'EUR', date: '2026-09-29', rates: { USD: 1.1 } }), /annulée/);
  assert.throws(() => parseRates(null), /inattendue/);
});

test('passe taux : écrit par (base, quote) et journalise', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const fetchImpl = async (url) => { assert.match(String(url), /\/latest\?base=EUR$/); return new Response(JSON.stringify(RATES)); };
    const stats = await ratesPass({ sb, cfg, fetchImpl, log: silent });
    assert.equal(stats.written, 10);
    const write = fake.calls.find((c) => c.method === 'POST' && c.path.endsWith('/exchange_rates'));
    assert.equal(write.query.on_conflict, 'base,quote');
    assert.equal(write.body.length, 10);
    assert.equal(fake.calls.at(-1).body.status, 'done');
  } finally { await fake.close(); }
});
