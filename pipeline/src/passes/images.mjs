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

export async function imagesPass({ sb, cfg, max = 20, country = null, fetchImpl = fetch, throttle = new Throttle(cfg.pexelsIntervalMs), log = console.log }) {
  if (!cfg.pexelsKey) throw new Error('PEXELS_API_KEY manquante (secret GitHub ou variable locale).');
  const runId = await startRun(sb, { pass: 'images', source: 'pexels', license: 'Pexels License' });
  const stats = { read: 0, kept: 0, written: 0 };
  try {
    // Villes sans photo de couverture, les plus peuplées d'abord
    const cities = await sb.select('cities',
      `select=id,name,country_code,countries(name_en)&cover_media_id=is.null${country ? `&country_code=eq.${encodeURIComponent(String(country).toUpperCase())}` : ''}&order=population.desc.nullslast&limit=${max}`);
    for (const city of cities) {
      await throttle.wait();
      const q = `${city.name} ${city.countries?.name_en ?? ''} city`.trim();
      const res = await fetchRetry(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=5&orientation=landscape`,
        { headers: { Authorization: cfg.pexelsKey } }, { fetchImpl, retries: 2, baseDelayMs: 5000 });
      const remaining = Number(res.headers.get('x-ratelimit-remaining'));
      const { photos = [] } = await res.json();
      stats.read++;
      const best = photos[0];
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
