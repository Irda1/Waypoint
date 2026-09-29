// Passe 3 · lieux d'une ville — OpenStreetMap via Overpass (ODbL 1.0).
// Une ville = quelques requêtes (groupes), triées « l'essentiel d'abord », écrites
// avec la source, la licence et la date. Une panne d'un groupe n'arrête pas les autres.
import { fetchRetry, Throttle } from '../lib/http.mjs';
import { GROUPS, buildOverpassQuery, radiusForCity, elementToPlace, selectEssential, OSM_LICENSE } from '../lib/osm.mjs';
import { startRun, finishRun } from '../lib/run.mjs';

export async function fetchOverpass(cfg, query, { fetchImpl = fetch, throttle }) {
  await throttle?.wait();
  const res = await fetchRetry(cfg.overpassUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  }, { fetchImpl, retries: 4, baseDelayMs: 10_000, timeoutMs: 180_000 });
  const json = await res.json();
  if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
    throw new Error(`Overpass : ${json.remark}`);
  }
  return json.elements ?? [];
}

/** Collecte et écrit les lieux d'une ville. @returns statistiques */
export async function placesPass({ sb, cfg, city, fetchImpl = fetch, throttle = new Throttle(cfg.overpassIntervalMs), radiusM = null, log = console.log }) {
  const runId = await startRun(sb, { pass: 'places', source: 'openstreetmap', scope: `city:${city.id}`, license: OSM_LICENSE });
  const stats = { read: 0, kept: 0, written: 0, failedGroups: [] };
  try {
    const radius = radiusM ?? radiusForCity(city.population);
    if (!sb.dryRun) await sb.patch('cities', `id=eq.${city.id}`, { collection_status: 'collecting' });

    const retrievedAt = new Date().toISOString();
    const mapped = [];
    for (const group of Object.keys(GROUPS)) {
      try {
        const query = buildOverpassQuery(group, { lat: city.lat, lng: city.lng, radiusM: radius });
        const elements = await fetchOverpass(cfg, query, { fetchImpl, throttle });
        stats.read += elements.length;
        for (const el of elements) {
          const row = elementToPlace(el, city.id, { retrievedAt });
          if (row) mapped.push(row);
        }
        log(`  ${city.name} · ${group} : ${elements.length} éléments`);
      } catch (err) {
        stats.failedGroups.push(group);
        log(`  ${city.name} · ${group} : ÉCHEC (${err.message})`);
      }
    }
    // Aucune donnée du tout = vraie panne : on ne marque pas la ville comme remplie
    if (mapped.length === 0 && stats.failedGroups.length === Object.keys(GROUPS).length) {
      throw new Error('Overpass injoignable pour tous les groupes');
    }

    const kept = selectEssential(mapped);
    stats.kept = kept.length;
    const written = await sb.upsert('places', kept, { onConflict: 'osm_type,osm_id', returning: 'id,osm_type,osm_id' });
    stats.written = written.length;

    const idByKey = new Map(written.map((r) => [`${r.osm_type}/${r.osm_id}`, r.id]));
    const sources = kept
      .map((p) => ({
        place_id: idByKey.get(`${p.osm_type}/${p.osm_id}`),
        source: 'openstreetmap',
        external_id: `${p.osm_type}/${p.osm_id}`,
        license: OSM_LICENSE,
        license_risk: 'ok',
        retrieved_at: retrievedAt,
        run_id: runId,
      }))
      .filter((r) => r.place_id != null);
    await sb.upsert('place_sources', sources, { onConflict: 'place_id,source' });

    // Une ville avec un groupe en échec reste « ready » mais le journal le signale ; on relance au besoin.
    await sb.patch('cities', `id=eq.${city.id}`, { collection_status: 'ready', places_collected_at: new Date().toISOString() });
    log(`${city.name} : ${stats.read} éléments lus, ${stats.kept} lieux gardés${sb.dryRun ? ' (simulation)' : `, ${stats.written} écrits`}.`);
    await finishRun(sb, runId, stats, stats.failedGroups.length ? new Error(`groupes en échec : ${stats.failedGroups.join(', ')}`) : null);
    return stats;
  } catch (err) {
    if (!sb.dryRun) await sb.patch('cities', `id=eq.${city.id}`, { collection_status: 'failed' }).catch(() => {});
    await finishRun(sb, runId, stats, err);
    throw err;
  }
}
