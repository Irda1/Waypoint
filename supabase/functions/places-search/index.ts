// Waypoint · fonction Edge « places-search » : recherche de lieux Geoapify pour l'appli, sans montrer la clé.
//
// L'appli (src/data/cityCollection.ts) envoie { categories, lat, lng, radiusM, offset } ; la fonction vérifie que la
// personne est connectée, contrôle ces valeurs, appelle Geoapify Places avec la clé gardée ici et renvoie la réponse.
// En erreur, l'appli se rabat sur OpenStreetMap (Overpass).
// Secret : GEOAPIFY_API_KEY ; SUPABASE_URL et SUPABASE_ANON_KEY sont fournis par Supabase. Aucune dépendance :
// le fichier se colle tel quel dans l'éditeur de fonctions de Supabase.

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };

export interface PlacesQuery { categories: string; lat: number; lng: number; radiusM: number; offset: number }

/** Adresse Geoapify pour une demande valide, sinon null (catégories en lettres, coordonnées réelles, 30 km et 3 pages au plus). */
export function placesUrl(q: Partial<PlacesQuery>, key: string): string | null {
  const { categories, lat, lng, radiusM, offset } = q;
  if (typeof categories !== 'string' || categories.length > 300 || !/^[a-z_]+(\.[a-z_]+)*(,[a-z_]+(\.[a-z_]+)*)*$/.test(categories)) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (typeof radiusM !== 'number' || !Number.isInteger(radiusM) || radiusM < 1 || radiusM > 30_000) return null;
  if (offset !== 0 && offset !== 500 && offset !== 1000) return null;
  return `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${radiusM}&bias=proximity:${lng},${lat}&limit=500&offset=${offset}&apiKey=${encodeURIComponent(key)}`;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

if (typeof Deno !== 'undefined') {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      // Seulement pour une personne connectée (la clé publique de l'appli ne suffit pas).
      const user = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
        headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: req.headers.get('Authorization') ?? '' },
      });
      if (!user.ok) return reply({ error: 'Connexion requise' }, 401);
      const key = Deno.env.get('GEOAPIFY_API_KEY');
      if (!key) return reply({ error: 'Clé Geoapify absente' }, 503);
      const url = placesUrl(await req.json().catch(() => ({})), key);
      if (!url) return reply({ error: 'Demande invalide' }, 400);
      const res = await fetch(url);
      if (!res.ok) return reply({ error: `Geoapify ${res.status}` }, 502);
      return reply(await res.json());
    } catch (e) {
      return reply({ error: String(e) }, 500);
    }
  });
}
