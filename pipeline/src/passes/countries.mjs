// Passe 1 · pays — GeoNames countryInfo.txt (CC BY 4.0), noms fr/en via Intl (ICU de Node).
import { readFile } from 'node:fs/promises';
import { fetchRetry } from '../lib/http.mjs';
import { parseCountryInfo } from '../lib/geonames.mjs';
import { startRun, finishRun } from '../lib/run.mjs';

export async function countriesPass({ sb, cfg, file = null, fetchImpl = fetch, log = console.log }) {
  const runId = await startRun(sb, { pass: 'countries', source: 'geonames', license: 'CC BY 4.0' });
  try {
    const text = file
      ? await readFile(file, 'utf8')
      : await (await fetchRetry(`${cfg.geonamesBase}/countryInfo.txt`, {}, { fetchImpl })).text();
    const { rows, stats } = parseCountryInfo(text);
    stats.written = sb.dryRun ? 0 : rows.length;
    await sb.upsert('countries', rows, { onConflict: 'code' });
    log(`Pays : ${stats.read} lus, ${stats.kept} gardés${sb.dryRun ? ' (simulation)' : ', écrits'}.`);
    await finishRun(sb, runId, stats);
    return stats;
  } catch (err) {
    await finishRun(sb, runId, {}, err);
    throw err;
  }
}
