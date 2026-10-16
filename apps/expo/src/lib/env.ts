// Variables PUBLIQUES (préfixe EXPO_PUBLIC_ : intégrées à l'appli, lisibles par tous).
// Leur sécurité repose sur les règles RLS de la base, pas sur leur secret.
// Écrites en toutes lettres : Expo ne remplace que `process.env.EXPO_PUBLIC_XXX` littéral.
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
/** Numéro de version : 7 premiers caractères du commit, renseigné par les workflows (GitHub Actions n'a pas de fonction pour couper un texte). */
export const BUILD_ID: string = (process.env.EXPO_PUBLIC_BUILD_ID ?? 'local').slice(0, 7);
export const isConfigured: boolean = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
/** Adresse du site web de l'appli (pour les liens de partage ouverts hors de l'appli). Sur le web, l'adresse courante est utilisée. */
export const WEB_URL: string = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://irda1.github.io/Waypoint';
