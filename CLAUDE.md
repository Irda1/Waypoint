# Waypoint

Compagnon de voyage collaboratif (Expo + Supabase). Contexte complet : `docs/CONTEXT-CLAUDE-CODE.md` (à lire en début de session). Détails : `docs/BACKEND.md`, `docs/DESCRIPTION-TECHNIQUE.md`.

## Façon de travailler
- Répondre **en français**, court et simple, résultat d'abord. Adrien est non-expert en code : dire précisément où cliquer/taper.
- Mode « ponytail » actif (skill `ponytail`) : plus petit changement qui marche, réutiliser l'existant, pas de dépendance ni d'abstraction non demandée.
- Jamais d'identifiants, clés ou comptes de test dans le dépôt. Proposer avant de changer des réglages.
- Après un squash-merge, repartir de `origin/main` frais.

## Commandes
Appli (`apps/expo`) :
- `npm install` · `npm test` (tests du domaine) · `npm run typecheck` (doit rester propre)
- `npx expo start --web` (local, http://localhost:8081) · `npm run export:web` (dossier `dist` pour Netlify)

Racine : `node --test pipeline/test/*.test.mjs` (collecte) · `bash supabase/tests/run-local.sh` (schéma + RLS, PostgreSQL jetable) · `node scripts/bundle-sql.mjs [--check]`.

## Structure
- `apps/expo/app` écrans · `src/features` UI · `src/data` Supabase/hors ligne · `src/domain` logique pure testée. `*.web.ts(x)` = version web.
- `public/globe.html` et `public/map.html` sont **générés** (`domain/globe.ts`, `domain/map.ts`) : les regénérer après modif, un test vérifie la cohérence.
- `supabase/migrations/` migrations ; `supabase/all-migrations.sql` est **généré**, ne pas l'éditer. Skill : `supabase-migrations`.
- `.github/workflows/apk-app.yml` APK Android. Skill : `apk-build`.
- `web/` + `capacitor.config.json` : ancienne maquette (v0.9), séparée de l'appli Expo.

## Pièges
- Le cloud n'a que la clé anon : il ne peut pas exécuter de migration (Adrien les lance dans le SQL Editor).
- Dans le template de `globeHtml()`, écrire `\\n` pour un retour à la ligne dans le JS de la page.
- Un seul canal Realtime par écran ; relancer `expo start` après ajout de dépendance.
- Netlify ne se met pas à jour seul : redéposer un `dist` neuf.
