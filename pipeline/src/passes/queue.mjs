// Consommateur de la file de collecte : prend les villes demandées par l'app, une à une.
// « Flux unique » : une tâche à la fois. Plus tard, on pourra lancer plusieurs
// consommateurs sans rien changer (claim_collection_job utilise SKIP LOCKED).
import { placesPass } from './places.mjs';
import { coverForCity } from './images.mjs';

export async function queuePass({ sb, cfg, max = 3, fetchImpl = fetch, log = console.log, ...rest }) {
  const summary = { done: 0, failed: 0 };
  for (let i = 0; i < max; i++) {
    const jobs = await sb.rpc('claim_collection_job', { p_pass: 'places' });
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) { log('File vide.'); break; }

    const [city] = await sb.select('cities', `select=id,name,lat,lng,population,cover_media_id,countries(name_en)&id=eq.${job.city_id}`);
    try {
      if (!city) throw new Error(`ville ${job.city_id} introuvable`);
      await placesPass({ sb, cfg, city, fetchImpl, log, ...rest });
      // Photo de la ville en même temps que ses lieux (si elle n'en a pas) ; un échec ici ne fait pas échouer la tâche.
      if (cfg.pexelsKey && !city.cover_media_id) {
        try { await coverForCity({ sb, cfg, city, fetchImpl, log }); } catch (err) { log(`  ${city.name} : photo non trouvée (${err.message})`); }
      }
      await sb.patch('ingestion_queue', `id=eq.${job.id}`, { status: 'done', finished_at: new Date().toISOString(), error: null });
      summary.done++;
    } catch (err) {
      // 3 tentatives au plus, puis on abandonne pour ne pas boucler indéfiniment
      const giveUp = job.attempts >= 3;
      await sb.patch('ingestion_queue', `id=eq.${job.id}`, {
        status: giveUp ? 'failed' : 'queued',
        finished_at: giveUp ? new Date().toISOString() : null,
        error: String(err.message).slice(0, 500),
      });
      summary.failed++;
      log(`Tâche ${job.id} en échec (tentative ${job.attempts}) : ${err.message}`);
    }
  }
  return summary;
}
