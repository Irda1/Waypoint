import { defineConfig } from '@playwright/test';

// Tests de parcours : le vrai site, construit comme pour GitHub Pages, mais relié à une fausse adresse Supabase.
// Chaque test répond lui-même aux appels (e2e/serveur.ts) : aucune vraie base, aucune clé, aucun compte.
// Lancer : `npx playwright test` dans apps/expo (construit le site la première fois, environ 2 minutes).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 420, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', screenshot: 'only-on-failure' },
  webServer: {
    // --clear : sans lui, Expo peut reprendre une compilation faite avec les vraies adresses.
    command: 'npx expo export --platform web --clear && node e2e/site.mjs',
    url: 'http://localhost:4173',
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { EXPO_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'cle-publique-factice-des-tests-de-parcours', EXPO_PUBLIC_GEOAPIFY_KEY: '' },
  },
});
