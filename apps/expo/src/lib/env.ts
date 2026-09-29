// Variables PUBLIQUES (préfixe EXPO_PUBLIC_ : intégrées à l'appli, lisibles par tous).
// Leur sécurité repose sur les règles RLS de la base, pas sur leur secret.
// Écrites en toutes lettres : Expo ne remplace que `process.env.EXPO_PUBLIC_XXX` littéral.
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isConfigured: boolean = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
