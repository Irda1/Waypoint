# Waypoint — contexte complet du projet (à jour v1.11.20, 11/10/2026)

Document de reprise : à donner à toute nouvelle session Claude. Détails techniques : `docs/BACKEND.md` (guide + journal de chaque version), `docs/DESCRIPTION-TECHNIQUE.md`.

## 1. L'utilisateur et la façon de travailler
- **Adrien** (GitHub `Irda1`, dépôt `Irda1/Waypoint`), francophone, non-expert en code, Windows.
- **Toujours répondre en français**, court et simple, résultat d'abord. Dire précisément où cliquer/taper.
- Il valide avec des captures d'écran. Il a autorisé à **pousser sur main, ouvrir et fusionner (squash) les PR sans demander** à chaque fois.
- Répartition : la session cloud écrit et pousse le code ; la session « PC » (Remote Control) ne fait que : `git pull`, localhost, tests, contrôle de l'APK.
- Ne jamais écrire d'identifiants (compte de test, clés) dans le dépôt ni la mémoire. Présenter une proposition avant de changer des réglages.

## 2. Produit
Compagnon de voyage collaboratif : créer un voyage (pays, dates, villes avec nuits, voyageurs, envies, budget), programme jour par jour, carte, météo, budget et partage des dépenses entre amis, hors connexion. Principes : simplicité, fiabilité (estimations marquées « ≈ », jamais de faux « temps réel »), **l'IA propose, l'utilisateur décide**. Référence design : maquettes V5 « immersif sombre » et prototype « Escale v0.8 » (thème Crépuscule, nuit/jour/auto, accents).

## 3. Fonctionnalités principales (état v1.11.20)
- **Deux modes de voyage** (choix à la création) : **complet** (tout ce qui suit) ou **Simple « juste les lieux »** : un ou plusieurs pays, leurs villes, onglets Lieux (liste filtrable, ♡ = ma sélection, lien Google Maps, prix ≈, horaires du jour) · Carte · Budget (total ≈ de la sélection, sans partage de dépenses). Colonne `trips.mode` (migration 1900) ; `features/simple/`, `domain/simple.ts`.
- **Compte** : connexion e-mail/mot de passe, mot de passe oublié, changement de mot de passe, suppression du compte, Paramètres (Nuit/Jour/Auto, accent, style des icônes, rappels).
- **Accueil** : planète animée en fond (points + tracé, Jour ou Nuit), cartes voyage avec photo de la première ville, statut, compte à rebours, badge « Nouveau », carrousel « Envie de… », rejoindre un voyage par code.
- **Assistant de création** (barre d'étapes, fil des choix touchables, étapes qui glissent) : pays (Terre réaliste 2K/4K ou liste) → dates (calendrier ou « pas encore ») → villes (pays isolé en perspective, villes reliées par un arc, parcours repliable à glisser-déposer, nuits réparties automatiquement) → voyageurs → ville de départ (vols préremplis) → envies → budget → propositions (programme jour par jour) → récap.
- **Onglet Voyage** : en-tête = itinéraire 3D animé de ville en ville, résumé en 4 tuiles, sections repliables ; destinations (nuits recalculées, **réordonnables par glisser-déposer**), hébergements multiples (nuits, paiement), programme auto (horaires réalistes, lieux fermés écartés), « Non prévu » (favoris à planifier), réservations, « À ne pas oublier » (checklist partagée), mémo, export (texte + .ics), code d'invitation/Partager.
- **Onglet Jour** : s'ouvre sur aujourd'hui pendant le voyage, carte « Prochaine étape » (Y aller, Fiche, avancement de la journée), frise des jours (‹ ›, aujourd'hui entouré), photo de la ville du jour, étapes avec heures, glisser-déposer, vérif des horaires d'ouverture, plans B/C, « Journée en cours », fiche lieu (description courte base/Wikipédia, **entrée estimée**, durée, « Y aller · N min », Marquer payé, favoris).
- **Carte** (MapLibre + OpenFreeMap, **toujours en clair**) : programme numéroté par jour, lieux à découvrir filtrables, recherche, légende, panneau glissant, favoris, bouton « Voir les détails ».
- **Budget** : total/budget, payé/prévu, reste par jour, détail par poste (icône, % du total, flèche de dépliage), Groupe/Par personne, dépense éclair (feuille : montant au clavier en monnaie locale ou du voyage, poste, payeur, libellé et activité liée en option, « Annuler »), carte repliable « Convertisseur », activités à payer (**préremplies : titre, poste, montant estimé × voyageurs**). **Amis** : graphique « Qui doit, qui reçoit », « Qui a payé quoi », « Pour être quittes » (relancer, marquer reçu).
- **Météo** Open-Meteo avec cache hors connexion ; **lecture hors connexion** des voyages ; **rappels** sur téléphone (veille du départ, 1 h avant la première étape).
- Temps de trajet : à pied/vélo/voiture calculés ; **transports en commun estimés** (vraie source = à faire).

- **Design** (v1.11.x) : direction « Crépuscule affiné » (nuit par défaut, Fraunces + Plus Jakarta Sans, accent soleil ; textes d'accroche sur fond nuit/photo = couleur claire de l'accent, `palette('nuit', accent).accent2`). Icônes au choix (émojis, trait, plein) via `ui/Icon.tsx` ; barre du bas avec icône + nom ; sections et cartes repliables (`Section`, `FoldCard`, `ChevronBadge` dans `ui/index.tsx`) ; fondus et glissements (`ui/FadeIn.tsx`, coupés si « réduire les animations »). **Tout changement visuel passe d'abord par une maquette (artifact) validée par Adrien**, avec toutes les fonctions existantes de l'écran.

## 4. Architecture
- **Backend** Supabase (Postgres + RLS + Realtime + RPC). Membres égaux. Migrations `supabase/migrations/2026092900*.sql` (0100→2200) lancées **à la main par Adrien** dans le SQL Editor (jusqu'à 1700 lancées ; **1800** = bouton « Élargir la zone », **1900** = mode Simple, **2000** = remontée des erreurs, **2100** = suppression du compte dans un voyage partagé, **2200** = quartiers rattachés à leur ville (puis relancer la collecte « cities ») : à lancer si pas fait). Le cloud n'a que la clé anon : il ne peut pas lancer de migration.
- **App** `apps/expo` : Expo SDK 57, expo-router, react-native-web. `app/` (écrans), `src/features/` (UI), `src/data/` (Supabase, hors ligne), `src/domain/` (logique pure testée, `npm test` = 217 tests, `npm run typecheck` doit rester propre). Fichiers `.web.ts(x)` = version web.
- Pages générées : `public/globe.html` (`domain/globe.ts`), `public/route.html` (`domain/routeGlobe.ts`), `public/regions.html` (`domain/regionsMap.ts`), `public/map.html` (`domain/map.ts`), `public/regions/XX.json` ; un test vérifie la cohérence. Images de la Terre (NASA, domaine public) dans `public/tex` : 2K chargées d'abord, 4K quand la planète est grande à l'écran ; le mobile les lit sur GitHub (`REGIONS_BASE_NATIVE`).
- **Erreurs de l'appli** (v1.11.18) : plantages et erreurs non rattrapées envoyés à `log_client_error` (`src/data/errors.ts`, écran de secours `ErrorBoundary` dans `app/_layout.tsx`), table `client_errors` lisible seulement dans Supabase > Table Editor (pas depuis l'appli ni le cloud).
- **Vérifications automatiques** : `.github/workflows/verifications.yml` sur chaque PR et chaque fusion (tests + typage de l'appli, tests de la collecte, `bundle-sql --check`, schéma + RLS sur PostgreSQL jetable).
- **Lieux d'une ville** : chargés par l'appli (`domain/cityCollect.ts`) via **Geoapify Places** d'abord (clé publique `EXPO_PUBLIC_GEOAPIFY_KEY`, secret GitHub `GEOAPIFY_API_KEY` ; stockage en base autorisé par le support Geoapify le 06/10/2026), repli sur Overpass ; bouton « Élargir la zone » sur la carte (rayon ×2 puis ×3,5). La clé est visible dans l'appli : voir le journal v1.10.62 de `docs/BACKEND.md`.
- **Collecte de données** (`pipeline/`, workflow « Collecte de données ») : GeoNames, OSM, photos Pexels (villes). Secrets Actions : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PEXELS_API_KEY`.
- **Diffusion** : web = **GitHub Pages** https://irda1.github.io/Waypoint/, reconstruit et publié seul à chaque fusion dans main (`web-app.yml`, 2-3 min ; le site vit sous `/Waypoint`, d'où `WEB_BASE`). Netlify n'est plus utilisé. APK Android = workflow `apk-app.yml`, lien stable https://github.com/Irda1/Waypoint/releases/download/app-latest/waypoint-app.apk (secret `SUPABASE_ANON_KEY` ajouté).
- Variables `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `apps/expo/.env.local` (PC) ou l'environnement cloud.

## 5. Lancer en local (PC d'Adrien)
Dépôt : `C:\Users\Adrien\Documents\Waypoint-project`. `git pull`, puis dans `apps\expo` : `npm install` (si nouvelle dépendance), `npx expo start --web`, ouvrir http://localhost:8081. Le site en ligne n'a rien à déposer : il se met à jour seul après chaque fusion.

## 6. Vérifié / non vérifié
- Vérifié : tests unitaires, typage, export web, globe/cartes dans Chromium, connexion et création de voyage sur données réelles (PC).
- **Non vérifié sur appareil** : rappels (natif), mode hors connexion, glisser-déposer mobile, nouvelles cartes (réservations, checklist) avec données réelles, carte des villes (défilement bloqué sous le doigt, parcours repliable).

## 7. Licences
Open-Meteo gratuit = usage non commercial (à changer avant publication commerciale). OpenFreeMap, OSM (ODbL), GeoNames, Pexels (clé secrète), Wikipédia (CC BY-SA, attribution affichée), geoBoundaries, world-atlas/three.js via jsDelivr. Images de la Terre : NASA (domaine public), relief GEBCO, mers Natural Earth ; zoom du globe : Sentinel-2 cloudless d'EOX (CC BY-NC 4.0, non commercial).

## 8. Reste à faire
**Feuille de route choisie par Adrien le 11/10/2026** (une PR à la fois, dans cet ordre ; maquette validée d'abord pour tout ce qui se voit) :
1. **Fondations** : une seule adresse (GitHub Pages) ✓, vérifications automatiques ✓, planète plus légère ✓, documentation ✓ (v1.11.17), remontée des erreurs ✓ (v1.11.18, migration 2000).
2. **Pendant le voyage** ✓ (v1.11.20) : écran « Aujourd'hui », dépense éclair, squelettes de chargement, chiffres qui défilent, petites réactions (cœur, coche, puces).
3. **Finir la refonte** : carte et fiche d'un lieu (fiche qui glisse au doigt), Paramètres, mode Simple (complété : recherche par nom, passage Simple → Complet, mode visible sur l'accueil), pages de partage et Rejoindre, premier lancement et écrans vides, photos plus rapides (flou puis net, cache).
4. **Souvenirs** : carnet de voyage (photos et notes par jour), récap animé, bilan final des comptes et export, refaire ou partager un itinéraire ; animations (la carte devient la couverture, arrivée sur le pays, voyage créé avec avion + confettis, compte à rebours qui se retourne).
5. **Avant et ouverture** : importer une réservation depuis un e-mail, billets et PDF joints aux réservations, valise intelligente, notifications entre amis, clés cachées derrière le serveur (Geoapify : restreindre aux domaines du site ou passer par une fonction Supabase), tests de parcours automatiques, cartes natives sur téléphone, publication sur le Play Store (APK signé), licences à vérifier (Open-Meteo non commercial, imagerie EOX CC BY-NC).

Autres pistes, hors feuille de route :
- Vraies données de transports en commun (source externe + clé ; Google Maps en attendant).
- **Prix et billets d'avion** : aujourd'hui seulement une estimation ≈ d'après la distance. Piste retenue : API **Ignav** (1 000 requêtes offertes, prix actuels), appelée depuis une fonction Supabase pour garder la clé secrète. Amadeus Self-Service est fermé depuis le 17/07/2026.
- Cas limites des photos de villes ; assistant IA en langage naturel ; .ics aussi sur mobile.

## 9. Pièges connus
- Un canal Realtime unique par écran ; `expo start` à relancer après ajout de dépendance.
- Dans `globeHtml()` (template TypeScript), écrire `\\n` pour un retour à la ligne dans le JS de la page.
- Regénérer la page `public/*.html` correspondante après toute modif de `domain/globe.ts`, `routeGlobe.ts`, `regionsMap.ts` ou `map.ts`.
- Le site GitHub Pages est sous `/Waypoint` : liens de partage, retour de connexion Google et lien « mot de passe oublié » passent par `WEB_BASE`. Côté Supabase (Authentication → URL Configuration), `https://irda1.github.io/Waypoint/**` doit être dans les Redirect URLs.
- Après un squash-merge, repartir de `origin/main` frais pour éviter les conflits.
