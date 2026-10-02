// Configuration : uniquement des variables d'environnement. Aucune clé n'est
// écrite dans le code ni dans le dépôt (il est public).

export function loadConfig(env = process.env) {
  return {
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    pexelsKey: env.PEXELS_API_KEY || '',
    overpassUrl: env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
    // Serveurs de secours (essayés dans l'ordre). OVERPASS_URL seul (tests, serveur privé) = un seul serveur.
    overpassUrls: env.OVERPASS_URL ? [env.OVERPASS_URL] : [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ],
    geonamesBase: env.GEONAMES_BASE_URL || 'https://download.geonames.org/export/dump',
    ratesBase: (env.RATES_BASE_URL || 'https://api.frankfurter.dev/v1').replace(/\/+$/, ''),
    // Pause minimale entre deux requêtes Overpass (le serveur public est partagé)
    overpassIntervalMs: Number(env.OVERPASS_INTERVAL_MS || 5000),
    // Pexels : 200 requêtes/heure => au plus une toutes les 18 s
    pexelsIntervalMs: Number(env.PEXELS_INTERVAL_MS || 18_000),
  };
}

export function requireSupabase(cfg) {
  if (!cfg.supabaseUrl || !cfg.serviceKey) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (secrets GitHub Actions ou variables locales). '
      + 'La clé de service ne doit jamais être mise dans l\'application ni dans le dépôt.',
    );
  }
}
