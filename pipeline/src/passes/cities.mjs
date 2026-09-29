// Passe 2 · villes — GeoNames cities15000 (≈ 25 000 villes de plus de 15 000 habitants).
// On ne garde que ce dont l'app a besoin : nom, coordonnées, population, fuseau, région.
import { readFile } from 'node:fs/promises';
import { fetchRetry } from '../lib/http.mjs';
import { parseCities, parseAdmin1 } from '../lib/geonames.mjs';
import { readFirstZipEntry } from '../lib/zip.mjs';
import { startRun, finishRun } from '../lib/run.mjs';

export async function citiesPass({ sb, cfg, file = null, admin1File = null, country = null, minPopulation = 15000, fetchImpl = fetch, log = console.log }) {
  const runId = await startRun(sb, { pass: 'cities', source: 'geonames', scope: country ? `country:${country}` : 'all', license: 'CC BY 4.0' });
  try {
    const download = async (name) => Buffer.from(await (await fetchRetry(`${cfg.geonamesBase}/${name}`, {}, { fetchImpl })).arrayBuffer());

    let text;
    if (file) {
      const buf = await readFile(file);
      text = file.endsWith('.zip') ? readFirstZipEntry(buf).data.toString('utf8') : buf.toString('utf8');
    } else {
      text = readFirstZipEntry(await download('cities15000.zip')).data.toString('utf8');
    }
    const admin1Text = admin1File ? await readFile(admin1File, 'utf8') : (await download('admin1CodesASCII.txt')).toString('utf8');

    // Une ville n'est gardée que si son pays est déjà en base (clé étrangère)
    let known = null;
    if (!sb.dryRun) {
      known = new Set((await sb.select('countries', 'select=code&limit=1000')).map((r) => r.code));
      if (known.size === 0) throw new Error('Aucun pays en base : lancer d\'abord la passe « countries ».');
    }
    const { rows, stats } = parseCities(text, { admin1: parseAdmin1(admin1Text), minPopulation, countries: known, only: country });
    await sb.upsert('cities', rows, { onConflict: 'geonames_id', chunkSize: 1000 });
    stats.written = sb.dryRun ? 0 : rows.length;
    log(`Villes : ${stats.read} lues, ${stats.kept} gardées (${stats.skippedSmall} trop petites, ${stats.skippedCountry} pays absent)${sb.dryRun ? ' (simulation)' : ', écrites'}.`);
    await finishRun(sb, runId, stats);
    return stats;
  } catch (err) {
    await finishRun(sb, runId, {}, err);
    throw err;
  }
}
