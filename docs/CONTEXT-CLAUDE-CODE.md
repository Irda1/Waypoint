# Waypoint — contexte complet du projet (à jour v1.10.65, 07/10/2026)

Document de reprise : à donner à toute nouvelle session Claude. Détails techniques : `docs/BACKEND.md` (guide + journal de chaque version), `docs/DESCRIPTION-TECHNIQUE.md`.

## 1. L'utilisateur et la façon de travailler
- **Adrien** (GitHub `Irda1`, dépôt `Irda1/Waypoint`), francophone, non-expert en code, Windows.
- **Toujours répondre en français**, court et simple, résultat d'abord. Dire précisément où cliquer/taper.
- Il valide avec des captures d'écran. Il a autorisé à **pousser sur main, ouvrir et fusionner (squash) les PR sans demander** à chaque fois.
- Répartition : la session cloud écrit et pousse le code ; la session « PC » (Remote Control) ne fait que : `git pull`, localhost, tests, génération du `dist` pour Netlify, contrôle de l'APK.
- Ne jamais écrire d'identifiants (compte de test, clés) dans le dépôt ni la mémoire. Présenter une proposition avant de changer des réglages.

## 2. Produit
Compagnon de voyage collaboratif : créer un voyage (pays, dates, villes avec nuits, voyageurs, envies, budget), programme jour par jour, carte, météo, budget et partage des dépenses entre amis, hors connexion. Principes : simplicité, fiabilité (estimations marquées « ≈ », jamais de faux « temps réel »), **l'IA propose, l'utilisateur décide**. Référence design : maquettes V5 « immersif sombre » et prototype « Escale v0.8 » (thème Crépuscule, nuit/jour/auto, accents).

## 3. Fonctionnalités principales (état v1.10.65)
- **Deux modes de voyage** (choix à la création) : **complet** (tout ce qui suit) ou **Simple « juste les lieux »** : un ou plusieurs pays, leurs villes, onglets Lieux (liste filtrable, ♡ = ma sélection, lien Google Maps, prix ≈, horaires du jour) · Carte · Budget (total ≈ de la sélection, sans partage de dépenses). Colonne `trips.mode` (migration 1900) ; `features/simple/`, `domain/simple.ts`.
- **Compte** : connexion e-mail/mot de passe, mot de passe oublié, changement de mot de passe, suppression du compte, Paramètres (Nuit/Jour/Auto, accent, style des icônes, rappels).
- **Accueil** : cartes voyage avec photo (capitale du pays), statut, compte à rebours, carrousel « Envie de… », globe 3D animé (planète réaliste jour/nuit), rejoindre un voyage par code.
- **Assistant de création** : pays (globe 3D ou liste) → dates (calendrier ou « pas encore ») → villes (carte des régions, nuits réparties automatiquement) → voyageurs → envies → budget → propositions (programme jour par jour) → récap.
- **Onglet Voyage** : destinations (nuits recalculées, **réordonnables par glisser-déposer**), hébergements multiples (nuits, paiement), programme auto (horaires réalistes, lieux fermés écartés), « Non prévu » (favoris à planifier), réservations, « À ne pas oublier » (checklist partagée), mémo, export (texte + .ics), code d'invitation/Partager.
- **Onglet Jour** : photo de la ville du jour, étapes avec heures, glisser-déposer, vérif des horaires d'ouverture, plans B/C, « Journée en cours », fiche lieu (description courte base/Wikipédia, **entrée estimée**, durée, « Y aller · N min », Marquer payé, favoris).
- **Carte** (MapLibre + OpenFreeMap, **toujours en clair**) : programme numéroté par jour, lieux à découvrir filtrables, recherche, légende, panneau glissant, favoris, bouton « Voir les détails ».
- **Budget** : total/budget, payé/prévu, reste par jour, détail par poste, Groupe/Par personne, ajout de dépense (**prérempli depuis une activité liée : titre, poste, montant estimé × voyageurs**, « Payé par » masqué en solo), **Entre amis** (qui doit quoi, relancer, marquer reçu).
- **Météo** Open-Meteo avec cache hors connexion ; **lecture hors connexion** des voyages ; **rappels** sur téléphone (veille du départ, 1 h avant la première étape).
- Temps de trajet : à pied/vélo/voiture calculés ; **transports en commun estimés** (vraie source = à faire).

## 4. Architecture
- **Backend** Supabase (Postgres + RLS + Realtime + RPC). Membres égaux. Migrations `supabase/migrations/2026092900*.sql` (0100→1900) lancées **à la main par Adrien** dans le SQL Editor (jusqu'à 1700 lancées ; **1800** = bouton « Élargir la zone », **1900** = mode Simple : à lancer si pas fait). Le cloud n'a que la clé anon : il ne peut pas lancer de migration.
- **App** `apps/expo` : Expo SDK 57, expo-router, react-native-web. `app/` (écrans), `src/features/` (UI), `src/data/` (Supabase, hors ligne), `src/domain/` (logique pure testée, `npm test` = 202 tests, `npx tsc --noEmit` doit rester propre). Fichiers `.web.ts(x)` = version web.
- Pages générées : `public/globe.html` (depuis `domain/globe.ts`), `public/map.html` (depuis `domain/map.ts`), `public/regions/XX.json` ; un test vérifie la cohérence.
- **Lieux d'une ville** : chargés par l'appli (`domain/cityCollect.ts`) via **Geoapify Places** d'abord (clé publique `EXPO_PUBLIC_GEOAPIFY_KEY`, secret GitHub `GEOAPIFY_API_KEY` ; stockage en base autorisé par le support Geoapify le 06/10/2026), repli sur Overpass ; bouton « Élargir la zone » sur la carte (rayon ×2 puis ×3,5). La clé est visible dans l'appli : voir le journal v1.10.62 de `docs/BACKEND.md`.
- **Collecte de données** (`pipeline/`, workflow « Collecte de données ») : GeoNames, OSM, photos Pexels (villes). Secrets Actions : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PEXELS_API_KEY`.
- **Diffusion** : web = dossier `dist` (`npx expo export --platform web` dans `apps/expo`) déposé à la main sur Netlify (https://reliable-swan-f70bc4.netlify.app et cool-biscuit-29de47.netlify.app) ; APK Android = workflow `apk-app.yml`, lien stable https://github.com/Irda1/Waypoint/releases/download/app-latest/waypoint-app.apk (secret `SUPABASE_ANON_KEY` ajouté).
- Variables `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `apps/expo/.env.local` (PC) ou l'environnement cloud.

## 5. Lancer en local (PC d'Adrien)
Dépôt : `C:\Users\Adrien\Documents\Waypoint-project`. `git pull`, puis dans `apps\expo` : `npm install` (si nouvelle dépendance), `npx expo start --web`, ouvrir http://localhost:8081. Pour Netlify : `npx expo export --platform web`, puis glisser le dossier `dist` sur le site (Deploys).

## 6. Vérifié / non vérifié
- Vérifié : tests unitaires, typage, export web, globe/cartes dans Chromium, connexion et création de voyage sur données réelles (PC).
- **Non vérifié sur appareil** : rappels (natif), mode hors connexion, glisser-déposer mobile, installation et connexion de l'APK, nouvelles cartes (réservations, checklist) avec données réelles.

## 7. Licences
Open-Meteo gratuit = usage non commercial (à changer avant publication commerciale). OpenFreeMap, OSM (ODbL), GeoNames, Pexels (clé secrète), Wikipédia (CC BY-SA, attribution affichée), geoBoundaries, world-atlas/three.js via jsDelivr.

## 8. Reste à faire
1. Vraies données de transports en commun (source externe + clé ; Google Maps en attendant).
2. Vérifier l'APK et les rappels sur téléphone ; APK signé / Play Store.
3. Pièces jointes PDF pour les réservations ; .ics aussi sur mobile.
4. Cas limites des photos de villes ; assistant IA en langage naturel.

5. **Prix et billets d'avion** : aujourd'hui seulement une estimation ≈ d'après la distance. Piste retenue : API **Ignav** (1 000 requêtes offertes, prix actuels), appelée depuis une fonction Supabase pour garder la clé secrète. Amadeus Self-Service est fermé depuis le 17/07/2026.
6. Restreindre la clé Geoapify (domaines du site ; l'APK ne peut pas l'être) ou la passer derrière une fonction Supabase avant une ouverture au public.
7. Mode Simple : recherche par nom dans la liste, passage Simple → Complet, indication du mode sur l'accueil.

## 9. Pièges connus
- Un canal Realtime unique par écran ; `expo start` à relancer après ajout de dépendance.
- Dans `globeHtml()` (template TypeScript), écrire `\\n` pour un retour à la ligne dans le JS de la page.
- Regénérer `public/globe.html` après toute modif de `domain/globe.ts`.
- Netlify ne se met pas à jour tout seul : toujours redéposer un `dist` neuf (vérifier le nom du fichier `entry-…js`).
- Après un squash-merge, repartir de `origin/main` frais pour éviter les conflits.
