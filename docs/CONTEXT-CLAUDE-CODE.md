# Waypoint — contexte de reprise (pour Claude Code)

> Rédigé à la fin de la session « Claude (Cowork) » du 29/09/2026, version **v1.9.5**. Il permet de reprendre le projet sans perdre le fil.
> Les documents détaillés : `docs/BACKEND.md` (guide + journal des versions), `docs/DESCRIPTION-TECHNIQUE.md`, et le projet Claude « Application Organisateur De Voyage » (docs `claude/escale-*.md` = cahier des charges produit issu de la conception « Escale »).

## 1. L'utilisateur et la façon de travailler
- **Adrien** (GitHub `Irda1`, dépôt `Irda1/Waypoint`), francophone, **non-expert en code**, Windows (Expo lancé avec `npx expo start`, web sur `http://localhost:8081`).
- **Toujours répondre en français**, pas à pas, court et simple. Dire précisément où taper chaque commande (dossier `apps/expo`, terminal Windows : pas de `bash`, pas de `cp`).
- Il valide au fur et à mesure avec des captures d'écran. Jusqu'ici les mises à jour lui arrivaient en **zip à décompresser** (la session Cowork ne pouvait pas pousser sur Git) : **le passage à `git push` est justement le but de cette reprise.**
- Rôle attendu (cahier des charges du projet) : Product Manager + UX/UI + architecte + développeur senior ; ne pas inventer d'API ni de données ; proposer, comparer, recommander ; MVP par étapes ; ne jamais considérer une fonctionnalité finie sans vérifier logique, données, cas d'erreur.

## 2. Produit
Compagnon de voyage : profil → création d'un voyage (pays, dates, villes avec nuits, voyageurs, envies, budget) → programme jour par jour → carte → météo → (à venir) transports/trafic, recommandations, IA conversationnelle. Référence design/logique : la **maquette v0.9** `web/index.html` (thème « Crépuscule », nuit/jour, accents soleil/turquoise/corail/lavande). Principes : simplicité, personnalisation, contexte, **fiabilité** (données estimées marquées « ≈ », sources et fraîcheur visibles, jamais présenter comme temps réel ce qui ne l'est pas), flexibilité, **l'IA propose, l'utilisateur décide**.

## 3. Architecture et dépôt
- **Backend** : Supabase (Postgres + RLS + Realtime + RPC SECURITY DEFINER). Membres d'un voyage tous égaux (pas de rôles). Migrations exécutées **à la main** dans le SQL Editor (fichier `supabase/all-migrations.sql` regroupe tout, régénéré par `scripts/bundle-sql.mjs`).
- **Collecte de données** (`pipeline/`, workflow `.github/workflows/collecte.yml`) : GeoNames (pays, villes), OSM Overpass (lieux), Pexels (images). Secrets Actions : `SUPABASE_URL` (doit commencer par `https://`), `SUPABASE_SERVICE_ROLE_KEY`, `PEXELS_API_KEY` ; variable `COLLECTE_ACTIVE=true`. Passes : queue, countries, cities, places, images.
- **App** : `apps/expo` (Expo SDK 57, expo-router, react-native-web ; Android/iOS/web). Modules purs testables dans `src/domain/` et `src/lib/` (imports avec extension `.ts`, tests `node --test`, **77 tests** : `cd apps/expo && npm test`). UI dans `app/` et `src/features/`, données dans `src/data/`.
- Autres : `web/` (maquette vanilla), `resources/` + `capacitor.config.json` (ancienne piste APK Capacitor, icônes), `scripts/`.

```
apps/expo/app/            index (accueil) · new-trip (parcours) · trip/[id] · map/[id] · sign-in · join/
apps/expo/src/domain/     wizard, itinerary, weather, map, planning, budget, categories, countries, types (+ .test.ts)
apps/expo/src/data/       trips, places, itinerary, weather, useTrip (Realtime), categories
apps/expo/src/features/   wizard/ (7 étapes) · trip/ (DayCard, PlacePicker, ProgramCard, WeatherCard, BudgetCard…) · map/
apps/expo/public/map.html page de carte statique GÉNÉRÉE depuis domain/map.ts (test de cohérence)
supabase/migrations/      0100…0900 · seed-villes-phares.sql · tests/rls.test.sql
```

## 4. Historique des versions (détail dans docs/BACKEND.md)
- v1.0 backend Supabase complet + appli de base · v1.1 accueil (hero photo) · v1.2 écran voyage (couverture, budget, dépenses) · v1.3 lieux réels (recherche, ajout à un jour) · v1.4 villes (rang par titre/destinations) · v1.5 destinations (`trip_destinations`, migration 0800).
- **v1.6** parcours « Démarrer un voyage » repris d'Escale : pays (199, `domain/countries.ts`) → calendrier 13 mois ou « pas encore de dates » → villes avec **répartition automatique des nuits** (+/− avec le nombre entre les deux boutons) → voyageurs → envies → budget → récap → création (voyage, destinations avec nuits, jours avec ville, budget par poste). Migration **0900** + `seed-villes-phares.sql` (60 villes phares en français, à lancer une fois).
- **v1.7** programme automatique (`domain/itinerary.ts`) : jours vides remplis selon envies/budget/proximité (arrivée 14 h, déjeuner 12 h 30, dîner 20 h, lieux fermés écartés, retrait avant validation), « Ranger les horaires ».
- **v1.8** météo Open-Meteo (`domain/weather.ts`, `data/weather.ts`) : carte météo + conseil pluie/plein air par jour.
- **v1.9.x** carte MapLibre + fond OpenFreeMap : programme numéroté et relié par jour, lieux à découvrir filtrables, ajout au jour. Corrections : canal Realtime unique par écran (bug « cannot add postgres_changes callbacks after subscribe »), carte web servie par `public/map.html` (le mode `srcdoc` ne chargeait pas les tuiles chez lui).

## 5. Vérifié / non vérifié
- Vérifié par tests : toute la logique pure (77 tests) + SQL/RLS (`supabase/tests`, dernier run « TOUS LES TESTS PASSENT » avant v1.6).
- Confirmé par l'utilisateur (captures) : accueil, écran voyage, collecte → lieux → ajout à un jour, étape « villes » du parcours, carte qui s'affiche avec repères, traits et fond.
- **Jamais compilé ni lancé côté Cowork** (pas de npm dans son sandbox) : tout écran est validé par Adrien. Toujours lui faire vérifier après un changement d'UI.
- Non testé : Android/iOS (WebView de la carte, `react-native-webview` ajouté à package.json), flux complet création de voyage sur données réelles depuis v1.7, `places_nearby` (PostGIS), Google OAuth (reporté).

## 6. Licences et sécurité — à ne pas oublier
- **Open-Meteo : offre gratuite = usage NON commercial** (vérifié sur leur site). Publication Play Store commerciale ⇒ abonnement payant ou autre fournisseur (tout passe par `data/weather.ts`). Attribution CC BY 4.0 affichée.
- OpenFreeMap : usage commercial autorisé, sans clé ; attribution automatique via MapLibre. Tuiles OSM officielles : évitées (interdisent le téléchargement à l'avance/hors-ligne, exigent un User-Agent).
- Lieux OSM : ODbL, attribution affichée ; GeoNames : CC BY ; Pexels : clé à ne jamais exposer.
- **À faire par Adrien : régénérer la clé Pexels** (elle a été exposée dans une conversation). Ne JAMAIS committer : `.env*`, clé `service_role`, `ANDROID_DEBUG_KEYSTORE.txt` (fichier de clés Android, hors dépôt).
- Seules `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` vont dans l'appli (`apps/expo/.env.local`, non versionné).

## 7. État de Git — À LIRE AVANT DE POUSSER
- `origin/main` = commit `79de5c3` (« Add GitHub Actions workflow for data collection ») : l'état **v0.8.3 / v0.9** du dépôt. **Tout ce qui est décrit ci-dessus (v1.1 → v1.9.5) n'est PAS sur GitHub** : il n'existe que dans le dossier local d'Adrien (`waypoint-v1-backend`, zips décompressés) et dans l'archive complète `waypoint-complet-v1.9.5.zip`.
- L'arbre complet à jour est dans `waypoint-complet-v1.9.5.zip` (sans `node_modules`). Différences avec `main` : essentiellement `apps/expo/**`, `supabase/**` (migrations 0800, 0900, seed, tests), `docs/`, `.gitignore`, icônes `resources/`, `capacitor.config.json`, `package.json` racine.
- `.github/workflows/collecte.yml` : la version de `main` a été créée à la main sur GitHub par Adrien et **fonctionne** ; la version de l'archive est la même en plus sûre (variable `COLLECTE_ACTIVE`, entrées passées par variables d'environnement). Comparer puis garder la meilleure ; ne pas casser la collecte.
- Plan de reprise conseillé : (1) dans le dossier local d'Adrien, vérifier `git status`/`git remote -v` (le dépôt local n'est peut-être pas relié à GitHub) ; (2) **créer une branche** `maj-v1.9.5`, jamais de force-push sur `main` ; (3) committer par blocs logiques (v1.1–v1.5, v1.6, v1.7, v1.8, v1.9) avec des messages clairs en français ; (4) vérifier `.gitignore` avant `git add` (pas de `.env`, pas de keystore) ; (5) ouvrir une pull request que l'utilisateur fusionne.

## 8. Backlog prioritaire
1. Pousser l'état actuel sur GitHub (section 7).
2. **Design** : appliquer réellement la maquette Crépuscule à l'appli (photos en couvertures, cartes, hiérarchie, animations légères) — l'UI actuelle est fonctionnelle mais sobre (l'utilisateur en est conscient : « le front viendra après »).
3. Transports et trafic (vérifier d'abord chaque API : couverture, prix, licence ; distinguer temps réel / horaire théorique / estimé).
4. Recommandations contextuelles (météo + temps libre + budget), puis assistant IA en langage naturel (Phase 3).
5. Petites choses : filtre « Pratique » (toilettes, pharmacies…), recherche de lieux insensible aux accents, écran « Activités proposées » plus riche dans le parcours (aujourd'hui : bloc « Programme automatique » sur l'écran voyage), notifications, hors-ligne, Google OAuth, itinéraires routiers réels (les trajets sont estimés à vol d'oiseau × 1,3).
6. Vérifier sur appareil Android réel : carte (WebView), polices, permissions localisation.
7. Mettre à jour `docs/BACKEND.md` (journal) et le doc projet `claude/waypoint-v1-backend-guide.md` à chaque version.

## 9. Pièges connus
- Villes GeoNames en anglais (« Lisbon ») : les noms français viennent du seed des villes phares ; les upserts par `geonames_id` ne touchent pas `name_fr`/`featured_rank`.
- Realtime : abonnement sans filtre (les DELETE ne portent que la clé primaire) ; **un canal par écran** (nom unique) car plusieurs écrans montent `useTrip` en même temps.
- `expo start` doit être relancé quand on ajoute un dossier (ex. `public/`) ou une dépendance (`npm install`).
- Le sandbox Cowork bloquait l'accès aux serveurs de cartes : les problèmes de fond de carte se diagnostiquent chez l'utilisateur (page `test-carte.html`, bandeau de diagnostic de `map.html`).
- Les drapeaux emoji s'affichent en lettres sous Windows (normal).
