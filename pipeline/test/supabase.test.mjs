import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabase } from '../src/lib/supabase.mjs';
import { fetchRetry, Throttle, HttpError } from '../src/lib/http.mjs';
import { startFakeSupabase } from './helpers.mjs';

test('upsert : en-têtes, fusion, découpage en lots, colonnes de conflit', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'SERVICE' });
    const rows = Array.from({ length: 5 }, (_, i) => ({ geonames_id: i, name: `V${i}` }));
    await sb.upsert('cities', rows, { onConflict: 'geonames_id', chunkSize: 2 });
    assert.equal(fake.calls.length, 3);
    assert.deepEqual(fake.calls.map((c) => c.body.length), [2, 2, 1]);
    const c = fake.calls[0];
    assert.equal(c.method, 'POST');
    assert.equal(c.path, '/rest/v1/cities');
    assert.equal(c.query.on_conflict, 'geonames_id');
    assert.equal(c.headers.apikey, 'SERVICE');
    assert.equal(c.headers.authorization, 'Bearer SERVICE');
    assert.equal(c.headers.prefer, 'resolution=merge-duplicates,return=minimal');
    assert.match(c.headers['user-agent'], /WaypointPipeline/);
  } finally { await fake.close(); }
});

test('upsert avec retour : récupère les identifiants', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    const out = await sb.upsert('places', [{ osm_type: 'node', osm_id: 1, name: 'A' }], { onConflict: 'osm_type,osm_id', returning: 'id,osm_type,osm_id' });
    assert.deepEqual(out, [{ id: 100, osm_type: 'node', osm_id: 1 }]);
    assert.equal(fake.calls[0].query.select, 'id,osm_type,osm_id');
    assert.equal(fake.calls[0].headers.prefer, 'resolution=merge-duplicates,return=representation');
  } finally { await fake.close(); }
});

test('simulation : rien n\'est écrit', async () => {
  const fake = await startFakeSupabase();
  try {
    const logs = [];
    const sb = createSupabase({ url: fake.url, serviceKey: 'K', dryRun: true, log: (m) => logs.push(m) });
    await sb.upsert('cities', [{ a: 1 }], { onConflict: 'a' });
    await sb.patch('cities', 'id=eq.1', { a: 2 });
    assert.equal(fake.calls.length, 0);
    assert.match(logs[0], /simulation/);
  } finally { await fake.close(); }
});

test('nouvelle tentative sur 503 puis succès ; erreur claire sur 400', async () => {
  const fake = await startFakeSupabase();
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    fake.state.failOnce['POST /rest/v1/countries'] = 503;
    await sb.upsert('countries', [{ code: 'PT' }], { onConflict: 'code' });
    assert.equal(fake.calls.length, 2, 'une nouvelle tentative a eu lieu');

    fake.state.failOnce['POST /rest/v1/countries'] = 400;
    await assert.rejects(() => sb.upsert('countries', [{ code: 'PT' }], { onConflict: 'code' }), (e) => e instanceof HttpError && e.status === 400 && /boom/.test(e.message));
  } finally { await fake.close(); }
});

test('rpc et select', async () => {
  const fake = await startFakeSupabase({ onRequest: (c) => (c.path.endsWith('/rpc/claim_collection_job') ? { body: [{ id: 7, city_id: 3 }] } : null) });
  try {
    const sb = createSupabase({ url: fake.url, serviceKey: 'K' });
    assert.deepEqual(await sb.rpc('claim_collection_job', { p_pass: 'places' }), [{ id: 7, city_id: 3 }]);
    assert.deepEqual(fake.calls[0].body, { p_pass: 'places' });
    assert.deepEqual(await sb.select('cities', 'select=id&limit=1'), []);
    assert.equal(fake.calls[1].query.limit, '1');
  } finally { await fake.close(); }
});

test('fetchRetry : Retry-After respecté, plus de tentatives que prévu = erreur', async () => {
  let n = 0;
  const fetchImpl = async () => {
    n++;
    return new Response('trop vite', { status: 429, headers: { 'retry-after': '0' } });
  };
  await assert.rejects(() => fetchRetry('http://x.test/', {}, { fetchImpl, retries: 2, baseDelayMs: 1 }), (e) => e.status === 429);
  assert.equal(n, 3);
});

test('Throttle : espace les appels', async () => {
  const t = new Throttle(40);
  const start = Date.now();
  await t.wait(); await t.wait(); await t.wait();
  assert.ok(Date.now() - start >= 75, 'deux pauses de ~40 ms');
});
