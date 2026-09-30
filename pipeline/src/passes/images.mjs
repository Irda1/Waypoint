// Passe 5 · images de villes — Pexels API (200 requêtes/heure, 20 000/mois).
// On stocke des LIENS + le crédit du photographe (obligatoire), pas les fichiers.
import { fetchRetry, Throttle } from '../lib/http.mjs';
import { startRun, finishRun } from '../lib/run.mjs';

export function photoToMedia(photo) {
  return {
    provider: 'pexels',
    provider_id: String(photo.id),
    url_small: photo.src?.small ?? null,
    url_medium: photo.src?.medium ?? null,
    url_large: photo.src?.large2x ?? photo.src?.large ?? null,
    page_url: photo.url ?? null,
    author: photo.photographer ?? null,
    author_url: photo.photographer_url ?? null,
    attribution: `Photo : ${photo.photographer ?? 'auteur inconnu'} / Pexels`,
    license: 'Pexels License',
    width: photo.width ?? null,
    height: photo.height ?? null,
    avg_color: photo.avg_color ?? null,
    retrieved_at: new Date().toISOString(),
  };
}

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const LANDMARK = /skyline|cityscape|landmark|tower|bridge|temple|old town|palace|castle|cathedral|square|aerial|panorama|harbor|harbour|mosque|shrine|streets?\b/;
const OFF_TOPIC = /woman|man\b|men\b|girl|boy|portrait|selfie|couple|food|dish|meal|coffee|dog|cat\b|flower|car\b|interior|room|fashion|model/;

/** Note une photo : nom de la ville dans la description, monument ou vue d'ensemble, grande définition, pas de portrait. */
export function scorePhoto(photo, cityName) {
  const alt = norm(photo.alt);
  let score = 0;
  if (alt.includes(norm(cityName))) score += 4;
  if (LANDMARK.test(alt)) score += 2;
  if (OFF_TOPIC.test(alt)) score -= 4;
  if ((photo.width ?? 0) >= 3500) score += 1;
  if ((photo.width ?? 0) < (photo.height ?? 0)) score -= 5;
  return score;
}

export function bestPhoto(photos, cityName) {
  return photos.map((p, i) => ({ p, i, s: scorePhoto(p, cityName) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)[0]?.p;
}

export async function imagesPass({ sb, cfg, max = 20, country = null, redo = false, fetchImpl = fetch, throttle = new Throttle(cfg.pexelsIntervalMs), log = console.log }) {
  if (!cfg.pexelsKey) throw new Error('PEXELS_API_KEY manquante (secret GitHub ou variable locale).');
  const runId = await startRun(sb, { pass: 'images', source: 'pexels', license: 'Pexels License' });
  const stats = { read: 0, kept: 0, written: 0 };
  try {
    // Sans `redo` : villes sans photo, capitales et villes phares d'abord. Avec `redo` : on refait
    // les photos des seules capitales et villes phares (choix plus soigné qu'avant).
    const filter = redo ? '&or=(is_capital.eq.true,featured_rank.not.is.null)' : '&cover_media_id=is.null';
    const cities = await sb.select('cities',
      `select=id,name,country_code,countries(name_en)${filter}${country ? `&country_code=eq.${encodeURIComponent(String(country).toUpperCase())}` : ''}&order=is_capital.desc,featured_rank.asc.nullslast,population.desc.nullslast&limit=${max}`);
    for (const city of cities) {
      await throttle.wait();
      const q = `${city.name} ${city.countries?.name_en ?? ''} city`.trim();
      const res = await fetchRetry(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`,
        { headers: { Authorization: cfg.pexelsKey } }, { fetchImpl, retries: 2, baseDelayMs: 5000 });
      const remaining = Number(res.headers.get('x-ratelimit-remaining'));
      const { photos = [] } = await res.json();
      stats.read++;
      const best = bestPhoto(photos, city.name);
      if (best) {
        const [media] = await sb.upsert('media', [photoToMedia(best)], { onConflict: 'provider,provider_id', returning: 'id' });
        if (media) await sb.patch('cities', `id=eq.${city.id}`, { cover_media_id: media.id });
        stats.kept++;
        stats.written += media ? 1 : 0;
        log(`  ${city.name} : photo ${best.id} (${best.photographer})`);
      } else {
        log(`  ${city.name} : aucune photo trouvée`);
      }
      if (Number.isFinite(remaining) && remaining <= 5) {
        log(`Quota Pexels presque atteint (${remaining} restantes) : arrêt propre.`);
        break;
      }
    }
    await finishRun(sb, runId, stats);
    return stats;
  } catch (err) {
    await finishRun(sb, runId, stats, err);
    throw err;
  }
}
