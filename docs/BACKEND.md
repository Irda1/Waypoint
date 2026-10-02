# Waypoint · backend, collecte de données et application Expo

Ce guide met en route la v1 décrite dans le plan d'architecture : une base **Supabase** (PostgreSQL), un **pipeline de collecte** qui la remplit, et une application **Expo** (Android, iOS, web) qui la lit et permet d'éditer un voyage à plusieurs en temps réel. La maquette web/APK existante (`web/`, Capacitor) n'est pas touchée et continue de se publier comme avant.

```
supabase/            schéma SQL versionné, règles de sécurité, tests
pipeline/            collecte (GeoNames, OpenStreetMap, Pexels) vers la base, sans dépendance
apps/expo/           l'application universelle (routes dans app/, code dans src/)
.github/workflows/collecte.yml   lance le pipeline sur GitHub, sans ton ordinateur
```

## 1. Créer le projet Supabase

1. Crée un compte sur supabase.com puis un projet (région Europe, par exemple Paris ou Francfort). Note le mot de passe de la base, tu n'en auras pas besoin ensuite.
2. Dans **Project Settings > API**, relève trois valeurs :
   - l'**URL** du projet et la clé **anon / publishable** : elles sont publiques par conception et iront dans l'application ;
   - la clé **service_role / secret** : elle contourne toutes les règles de sécurité. Elle ne va **jamais** dans l'application ni dans le dépôt, seulement dans les secrets GitHub (étape 4).

## 2. Appliquer le schéma

Deux façons, au choix.

**Sans rien installer** : ouvre **SQL Editor > New query**, colle tout le contenu de `supabase/all-migrations.sql`, puis **Run**. À faire une seule fois sur un projet neuf.

**Avec la CLI Supabase** (recommandé si tu comptes faire évoluer le schéma) :

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

Les migrations vivent dans `supabase/migrations/` (une par thème, dans l'ordre). Après toute modification, régénère le fichier collable avec `node scripts/bundle-sql.mjs`.

Pour avoir des données d'exemple avant la première collecte (Portugal, Japon, France, quatre villes), exécute `supabase/seed.sql` dans l'éditeur SQL. Les lignes portent `source = 'seed'` et se retirent avec `delete from public.countries where source = 'seed'`.

## 3. Activer la connexion (email et Google)

Dans **Authentication > Providers**, l'email est actif par défaut. Par défaut aussi, Supabase demande de **confirmer l'adresse email** : l'appli le gère (message « ouvre le lien reçu »). Pour des tests entre amis tu peux désactiver la confirmation dans **Authentication > Sign In / Providers > Email**.

Pour **Google** :

1. Dans Google Cloud Console, crée un projet, puis **APIs & Services > Credentials > Create credentials > OAuth client ID**, type **Web application**.
2. Dans « Authorized redirect URIs », ajoute `https://<ref-du-projet>.supabase.co/auth/v1/callback`.
3. Copie l'identifiant et le secret client dans **Authentication > Providers > Google** de Supabase, et active-le.
4. Dans **Authentication > URL Configuration**, renseigne l'adresse du site web une fois publié (**Site URL**) et ajoute dans **Redirect URLs** : `waypoint://**` (mobile), `http://localhost:8081` (développement web) et l'adresse d'`Expo Go` que l'appli affiche au premier essai (`exp://…`), sinon la connexion Google revient sur une page d'erreur.

## 4. Configurer GitHub pour la collecte

Dans le dépôt : **Settings > Secrets and variables > Actions**.

| Nom | Type | Valeur |
|---|---|---|
| `SUPABASE_URL` | secret | l'URL du projet |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | la clé service_role |
| `PEXELS_API_KEY` | secret | une **nouvelle** clé Pexels |
| `COLLECTE_ACTIVE` | variable | `true`, quand tu veux que la file soit traitée toutes les 3 heures |

Les deux clés que tu avais collées dans la conversation (Country Data API et Pexels) sont à considérer comme exposées : régénère celle de Pexels avant de la mettre ici. La clé Country Data API n'est pas utilisée par cette version (voir « Écarts avec le plan »).

## 5. Remplir la base

Onglet **Actions > Collecte de données > Run workflow**. Lance les passes dans cet ordre :

1. `countries` : ≈ 250 pays depuis GeoNames (licence CC BY 4.0).
2. `cities` : les villes de plus de 15 000 habitants (≈ 25 000). Pour un premier essai, indique un pays, par exemple `PT`.
3. `places` avec l'identifiant d'une ville (`select id, name from cities where name in ('Lisboa', 'Porto');` dans l'éditeur SQL) : lieux depuis OpenStreetMap, triés par catégorie et par notoriété, avec plafond par catégorie.
4. `images` : une photo de couverture par ville depuis Pexels, avec le crédit du photographe.
5. `queue` : traite les villes que l'app a demandées (fonction `request_city_collection`). C'est aussi ce que fait l'exécution planifiée.

Cocher **Simulation** lit et trie sans rien écrire. Chaque passe est journalisée dans `ingestion_runs`, et chaque lieu garde sa source, sa licence, sa date de collecte et un niveau de risque de licence (`place_sources`).

Limites à connaître : une ville demande **4 requêtes Overpass** et le serveur public en tolère environ **100 par jour** pour un usage régulier (`OVERPASS_URL` permet de pointer vers une instance dédiée plus tard) ; Pexels autorise 200 requêtes par heure, le pipeline s'arrête proprement quand le quota est presque atteint.

Les mêmes commandes se lancent depuis ta machine : `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node pipeline/src/cli.mjs cities --country PT`. Avec `--dry-run` et des fichiers locaux (`--file`), aucune base ni réseau n'est nécessaire.

## 6. Lancer l'application

```bash
cd apps/expo
cp .env.example .env.local        # puis renseigner l'URL et la clé anon (publiques)
npm install
npx expo install --fix            # aligne les versions des modules natifs sur la version d'Expo
npx expo start                    # « a » pour Android, « w » pour le web
```

Un ami rejoint un voyage avec le lien d'invitation (bouton « Inviter un ami ») : il se connecte, devient membre à égalité avec les autres, et voit chaque modification en direct. Version web publiable : `npx expo export --platform web` (dossier `dist/`). Une build Android installable passe par EAS Build ou `npx expo run:android`.

**Polices** : Fraunces (titres) et Plus Jakarta Sans (texte) sont chargées au démarrage (`src/theme/useAppFonts.ts`) ; en cas d'échec ou de réseau lent, le système prend le relais après 2,5 s. Geist Mono n'est pas chargée : les chiffres utilisent la police à chasse fixe du système.

## 7. Vérifications automatiques

```bash
bash supabase/tests/run-local.sh          # schéma + sécurité sur un PostgreSQL jetable (≈ 90 vérifications)
node --test pipeline/test/*.test.mjs      # pipeline, avec de faux serveurs Supabase / Overpass
cd apps/expo && npm test                  # logique métier (budget, planning), thème, formats
```

Ces tests couvrent notamment : un non-membre ne voit ni ne modifie rien d'un voyage ; tout membre modifie tout, sans rôle ; une ligne ne peut pas être déplacée vers un autre voyage ; le journal garde l'ancienne et la nouvelle valeur ; un voyage ne se supprime pas en dur depuis l'appli (corbeille) ; la file de collecte ne donne jamais deux fois la même tâche ; les parts d'un budget partagé totalisent toujours exactement le total ; le contraste du thème respecte WCAG AA.

## 8. Pool de connexions (« tether ») : où on en est

Un seul flux au départ, et rien à construire : l'application n'ouvre **jamais** de connexion PostgreSQL, elle appelle l'API HTTPS de Supabase (PostgREST), et le pipeline fait de même avec la clé de service. La file `ingestion_queue` avec `claim_collection_job` (`FOR UPDATE SKIP LOCKED`) garantit qu'une tâche n'est prise qu'une fois et prépare le passage à plusieurs consommateurs sans changer le schéma. Le pooler de connexions de Supabase (Supavisor) ne devient utile que le jour où des fonctions serveur ou un backend maison ouvrent leurs propres connexions PostgreSQL ; ce sera l'étape « quelques dizaines d'amis » du plan.

## Écarts avec le plan d'architecture

- **Prix payé d'un hébergement** : pas de colonne dans `trip_stays`. C'est une dépense liée (`expenses.stay_id`), comme dans la maquette, ce qui évite de compter deux fois le même paiement.
- **Country Data API** non utilisée : ses droits de stockage en base n'ont pas été vérifiés. Les pays viennent de GeoNames (CC BY 4.0), les noms français et anglais de l'internationalisation de Node (`Intl.DisplayNames`), le drapeau est calculé.
- **Tables ajoutées** au plan : `place_categories` (les catégories évoluent par simple ajout de ligne), `ingestion_queue` (collecte à la demande), `trip_budget_lines` (budget prévu par poste). `place_translations`, `weather_cache`, `attachments`, `push_tokens` et `data_requests` restent pour plus tard.
- **Suppressions et temps réel** : Supabase ne contrôle pas les suppressions avec les règles de sécurité et ne les filtre pas par voyage. L'appli écoute donc sans filtre (la sécurité par ligne limite déjà les ajouts et modifications aux voyages dont on est membre) et ne recharge sur une suppression que si elle concerne une ligne qu'elle connaît. Les tables gardent l'identité de réplique par défaut (clé primaire seule) pour ne rien diffuser du contenu supprimé.
- **Voyage supprimé** : corbeille (`deleted_at`) plutôt que suppression définitive depuis l'appli, puisqu'aucun membre n'a plus de droits que les autres.
- **Membre qui quitte** : `left_at` plutôt qu'une suppression, pour que ses dépenses avancées restent à son nom dans les comptes.

## Ce qui n'a pas pu être vérifié dans cet environnement

- La migration PostGIS (`…0700_postgis.sql`, fonction `places_nearby`) : PostGIS n'était pas installé dans l'environnement de test ; le reste du schéma est testé sur un vrai PostgreSQL 16. À valider en exécutant les migrations sur ton projet Supabase, puis `select * from places_nearby(38.72, -9.14, 1000);` après une collecte.
- Les formats des fichiers GeoNames sont écrits d'après leur documentation ; les analyseurs vérifient le nombre de colonnes et s'arrêtent si le format change. Un premier essai réel avec `cities --country PT --dry-run` confirmera.
- L'application Expo n'a pas pu être compilée ni lancée ici (pas d'accès aux paquets npm) : sa logique métier est testée, le code des écrans a seulement été relu et vérifié par le compilateur TypeScript pour les erreurs internes. Prévois un premier passage `npm install`, `npx expo install --fix`, `npx expo start` et corrige les éventuelles différences de version.
- Ni Bright Data ni les API de collecte n'étaient joignables ici : les passes sont testées contre de faux serveurs, jamais contre les vrais.
- Les tarifs Supabase et Google Places, et les conditions d'usage de Pexels pour l'affichage des photos par lien, sont à relire avant l'ouverture au public.

## Journal des versions de l'application

- **v1.0** : socle (compte, voyages partagés en direct, budget, comptes entre amis) sur Supabase.
- **v1.1** : thème Crépuscule, polices Fraunces et Plus Jakarta Sans, écran d'accueil de la maquette (photo d'horizon).
- **v1.2** : écran d'un voyage repris de la maquette (couverture, jours en timeline, barres de budget).
- **v1.3** : recherche de lieux réels dans un jour (ville, nom, catégorie), heure d'une étape modifiable, mention OpenStreetMap.
- **v1.4** : le sélecteur propose d'abord les villes citées dans le titre du voyage, recherche d'une autre ville, ville mémorisée par jour.

- **v1.5** : destinations d'un voyage (nouvelle table `trip_destinations`, migration 0800) : choix des villes à la création, modifiables depuis le voyage, proposées en premier dans la recherche de lieux.
- **v1.6** : parcours « Démarrer un voyage » repris de la maquette Escale (pays, calendrier, villes avec nuits réparties, voyageurs, envies, budget, récapitulatif). Migration 0900, villes phares en français (`supabase/seed-villes-phares.sql`).
- **v1.7** : programme automatique (`domain/itinerary.ts`, testé) : propose les jours vides selon envies, budget d'activités et proximité (arrivée 14 h, déjeuner 12 h 30, dîner 20 h, lieux fermés écartés, retrait avant validation), et « Ranger les horaires » pour les étapes sans heure. Aucune migration.
- **v1.8** : météo (Open-Meteo, sans clé) : carte Météo (actuelle + prévisions du voyage, 16 jours max), météo et conseil pluie/plein air dans chaque jour. **Licence : l'offre gratuite est non commerciale ; une publication commerciale demande un abonnement Open-Meteo.** Attribution CC BY 4.0 affichée. Aucune migration.
- **v1.9** : carte (`domain/map.ts`, testé) : écran `/map/[id]` avec le programme numéroté par jour, filtre par jour, lieux à découvrir filtrables par catégorie, ajout au jour d'une touche. Fond OpenFreeMap (usage commercial autorisé, sans clé), MapLibre GL JS dans un iframe (web) ou une WebView (Android/iOS, nouvelle dépendance `react-native-webview` : relancer `npm install`). Hors ligne : fond vide.
- **v1.9.1** : correctif temps réel : chaque écran ouvre son propre canal (la carte et le voyage ouverts ensemble provoquaient « cannot add postgres_changes callbacks after subscribe »).
- **v1.9.2** : carte : les repères n'attendent plus la fin du chargement des tuiles ; bandeau de diagnostic (erreur du fond de carte) en bas à gauche.
- **v1.9.3** : carte : traits pointillés reliant les étapes de chaque jour (calque SVG, indépendant du fond) ; diagnostic réseau des tuiles ; repli automatique sur le style clair si le sombre ne charge pas en 8 s.
- **v1.9.4** : bouton « ← Voyage » de la carte (retour direct au voyage, même après rechargement) ; carte : le style est téléchargé par la page en cas de blocage, diagnostic détaillé (style, tuiles, taille de la zone).
- **v1.9.5** : carte web : la page de carte est servie comme fichier public (`apps/expo/public/map.html`, généré depuis `domain/map.ts`, test de cohérence) au lieu d'un iframe « srcdoc » ; réglages passés dans l'adresse.

- **v1.9.6** : accueil en cartes photo avec statut, correctifs de lisibilité (PR n°2) ; recherche de lieux sans accents (`accentTolerantTerm` : les lettres accentuables deviennent des jokers, sans migration ; cherche aussi un peu plus large) ; filtre « Pratique » (pharmacies, banques, laveries… : lieux de type `service`). Aucune migration.

- **v1.9.7** : taux de change. Migration 1000 (`exchange_rates`, lecture publique), passe `rates` du pipeline (Frankfurter / BCE, sans clé, ajoutée au workflow), `domain/currency.ts` (conversion via l'euro, jamais de taux inventé, « ≈ ») et `data/rates.ts`. La carte Budget affiche le total dépensé en monnaie locale du premier pays du voyage (« ≈ », taux BCE daté) quand elle diffère de la monnaie du voyage (v1.9.8). **Migration à exécuter seule dans le SQL Editor** (`supabase/migrations/20260929001000_exchange_rates.sql`), puis lancer la passe `rates`.

- **v1.9.9** : météo : heure de mise à jour affichée. Transports : volet « Itinéraire » entre deux étapes (et entre l'hébergement et la première/dernière étape quand le jour a un hébergement avec coordonnées) : replié, il montre le mode le plus rapide ; ouvert, à pied / à vélo / transports en commun / voiture avec la durée, chaque ligne ouvrant Google Maps (format « Maps URLs », sans clé) avec le bon mode de déplacement. À pied, vélo et voiture : itinéraire calculé sans circulation (serveur OSRM public FOSSGIS, une requête par seconde, demandé seulement à l'ouverture du volet, repli sur l'estimation ≈ de la maquette) ; transports : toujours estimation. `EXPO_PUBLIC_ROUTING_URL` remplace le serveur avant une ouverture au public. La durée réelle ne modifie pas encore la détection de chevauchements. Aucune migration. L'appli n'a pas encore d'écran pour créer un hébergement : les liens hébergement ne s'affichent qu'avec une ligne de `trip_stays` rattachée au jour.

- **v1.9.10** : recommandations textuelles d'une journée (`domain/advice.ts`, testé, règles lisibles, 3 conseils au plus, rien de modifié automatiquement) : journée vide, journée chargée (≥ 10 h), trajets lourds (≥ 1 h 30), aucun repas, créneau libre (≥ 2 h, si heures connues), beau temps sans plein air, jour au-dessus de 1,5 × le budget activités moyen. Bloc « Conseils » dans chaque jour. La pluie garde son conseil météo existant. Aucune migration, aucune IA.

- **v1.9.11** : hébergement. Carte « Hébergement » sur l'écran voyage : recherche d'un hôtel ou d'une auberge parmi les lieux collectés (`kind = lodging`), création d'une ligne `trip_stays` rattachée aux jours de la ville (`trip_days.stay_id`, `domain/stays.ts` testé), retrait possible. Les journées affichent alors le volet Itinéraire entre l'hébergement et la première / la dernière étape. Aucune migration.

- **v1.9.12** : montants affichés en nombres entiers ; ajout d'un jour à la main : la date doit rester dans les dates du voyage (avant, un jour du 18 octobre pouvait être ajouté à un voyage du 13 au 16) et la date du lendemain du dernier jour est proposée. Aucune migration.

Vérifié sur la vraie base (Lisbonne, 29/09/2026) : la collecte `places` remplit la ville, la recherche et l'ajout à un jour fonctionnent, les durées estimées sont marquées « ≈ ».

## Prochaines étapes

1. Premier déploiement : projet Supabase, migrations, secrets, passes `countries`, `cities`, puis `places` pour Lisbonne et Porto.
2. ~~Recherche et ajout de lieux réels dans un jour~~ (fait : bouton « Ajouter un lieu », recherche par ville, nom et catégorie ; heure modifiable). Reste : filtre « Pratique », carte, recherche sans accents (Belem / Belém).
3. Portage des écrans de la maquette (accueil, itinéraire, budget) avec le thème Crépuscule et les polices.
4. Météo, puis transports, seulement après lieux et carte réels.

## Transports et trafic : où on en est

- **À pied, vélo, voiture** : faits (v1.9.9), itinéraire calculé sans circulation, service public à usage léger, plus lien Google Maps pour les horaires et le trafic réels.
- **Transports en commun** : toujours estimés (« ≈ … · estimé »). Une vraie source demande des horaires GTFS par ville ou un service à clé (Navitia, Transitland, Google, HERE…) : couverture, prix et licence de stockage sont à vérifier un par un avant de choisir. Non faits ici : aucun de ces services n'a été testé.
- **Trafic en temps réel** : uniquement chez des services payants ou à clé ; ne jamais présenter comme temps réel une estimation.
- **v1.10.0 à v1.10.3** (refonte design, maquette V5) : barre de navigation flottante et onglets du voyage (Voyage, Jour, Budget, Amis), écran Paramètres (Nuit/Jour/Auto, accent, mémorisés sur l'appareil), fiche lieu en feuille du bas, budget « Revenir sous le budget » et coût par jour. Aucune migration.
- **v1.10.4** : écran « Entre amis » (phrase de solde, qui a payé quoi, pour être quittes, « Relancer », « Marquer reçu »). **Migration 1100** (`settlement_payments`) à exécuter dans le SQL Editor ; sans elle l'appli marche comme avant, sans le bouton « Marquer reçu ».
- **v1.10.5** : « Journée en cours » (étape actuelle, temps restant, prochaine étape, Passé / En cours / À venir), horaires du jour (départ du logement, retour souhaité, par défaut 09:30 / 23:30, colonnes déjà présentes dans trip_days), alerte « retour tardif » et « départ trop tôt », ouverture du jour d'aujourd'hui dans l'onglet Jour. Aucune migration.
- **v1.10.6** : favoris (cœur sur la fiche lieu et sur la carte, filtre « Favoris » de la carte), table `saved_places` déjà présente, aucune migration.
- **v1.10.7** : plans de repli créés depuis le plan A (plan B « journée allégée » : repas gardés, visites les plus lourdes retirées ; plan C « à l'abri » : sans nature ni sport). Aucune migration.
- **v1.10.8** : accueil : carrousel « Envie de… » (Lisbonne, Porto, Alfama, photos déjà dans l'appli) qui ouvre l'assistant de création. Aucune migration.
- **v1.10.9** : identité : icône de l'appli, icône adaptative Android, favicon et logo dans l'en-tête de l'accueil (générés par `scripts/generate-icons.mjs`, dessin du logo v0.9). Aucune migration.
- **v1.10.10** : accueil : toucher une idée « Envie de… » ouvre l'assistant avec le pays (Portugal) déjà choisi, la ville cochée et l'étape « Dates » directement. Aucune migration.
- **v1.10.11** : passe `images` : option pays (`--country PT`, champ « country » du workflow) pour photographier les villes d'un pays précis au lieu des plus peuplées du monde. Aucune migration.
- **v1.10.12** : les photos de villes collectées (Pexels) illustrent les cartes voyage et la couverture quand aucune photo de l'appli ne convient (Lisbonne, Porto, Alfama gardent les leurs) ; crédit du photographe affiché sur la couverture. Aucune migration.
- **v1.10.13** : carte voyage et grande couverture = photo de la capitale du pays, chaque journée = photo de sa ville (photos de la base, l'image intégrée reste le dernier recours) ; passe `images` plus soignée (choix de la photo selon sa description : nom de la ville, monument, grande définition, pas de portrait ni de format vertical), capitales et villes phares d'abord, option `--redo` (champ « redo » du workflow) pour refaire les photos existantes. Aucune migration.
- **v1.10.14** : écran Jour : grande photo de la ville du jour en fond d'en-tête (avec « Jour N sur M · date » et le nom de la ville), bande au-dessus des pastilles avec le nom de chaque ville sur ses jours, séparée par de fines barres (`cityRuns`, testé). Aucune migration.
- **v1.10.15** : mémo du voyage (carte « Mémo du voyage » de l'onglet Voyage : notes partagées, 4 000 caractères, colonne `trips.memo` déjà en base). Aucune migration.
- **v1.10.16** : budget : toucher un poste ouvre son détail (dépenses saisies, puis étapes prévues pas encore payées, `posteDetail` testé) ; « Modifier le budget de ce poste » et « Augmenter à … » quand il dépasse (écrit `trip_budget_lines`). Aucune migration.
- **v1.10.17** : jour : « ↑ Monter » / « ↓ Descendre » sur chaque étape (échange heure de début et rang avec la voisine, `swapWithNeighbor` testé). Aucune migration.
- **v1.10.18** : bouton « ＋ » flottant sur l'écran voyage : menu « Ajouter… » (une activité, une dépense, une note) qui ouvre la bonne carte. Aucune migration.
- v1.10.19 : Paramètres « Style des icônes » (couleur / trait / plein) appliqué à la barre du bas et au menu ＋ (rendu trait/plein sur le web).
- v1.10.20 : assistant de voyage, étape « Propositions » (aperçu du programme jour par jour, lieux à retirer, ou jours vides) ; le programme est écrit à la création du voyage. Aucune migration.
- v1.10.21 : carte, recherche d'un lieu par son nom (accents ignorés, centre la carte dessus) et légende (couleur des jours, trajet, lieux à découvrir). Aucune migration.
- v1.10.22 : hébergements multiples, bouton « Nuits » pour choisir les nuits de chaque hébergement (une nuit prise à un autre lui est retirée). Aucune migration.
- v1.10.23 : paiement d'un hébergement (bouton « Payer », dépense du poste Hébergement liée à l'hébergement, comptée dans le budget). Aucune migration.
- v1.10.24 : Budget, bascule « Groupe / Par personne » (affichage seulement : montants divisés par le nombre de voyageurs, budgets enregistrés inchangés, modification masquée en mode Par personne). Aucune migration.
- v1.10.25 : carte, bouton « Liste (N) » : panneau qui liste les repères affichés (jour et étape), un appui centre la carte sur le lieu. Aucune migration.
- v1.10.26 : fiche lieu, « ≈ X € à payer », « À partager entre N voyageurs » et bouton « Marquer payé » (dépense liée à l'étape, poste Repas ou Activités, montant restant). Aucune migration.
- v1.10.27 : jour, glisser-déposer des étapes (web ; boutons Monter/Descendre conservés), les heures restent sur leurs créneaux. Aucune migration.
- v1.10.28 : hébergement saisi à la main (nom, adresse) et modifiable ; dépense avec « Payé par » et « Activité liée ». Aucune migration.
- v1.10.29 : voyage, carte Destinations refaite : nuits recalculées à l'ajout, au retrait et au déplacement d'une ville, jours rattachés à leur ville, détail des nuits, ordre modifiable (flèches, glisser sur le web), liste de 5 villes du pays avec « Afficher plus » et recherche. Aucune migration.
- v1.10.30 : jour, une étape lâchée sur une autre les échange (web ; boutons Monter/Descendre gardés seulement sur mobile), icône colorée de la catégorie à la place de la pastille. Aucune migration.
- v1.10.31 : ajout d'un jour par mini calendrier ; « Vérifier les horaires d'ouverture » dans le jour (ouvert / fermé ce jour / hors créneau / inconnu, d'après les horaires OpenStreetMap des lieux). Aucune migration.
- v1.10.32 : Budget refait comme la maquette Escale : grand total / budget, marge ou dépassement, barre Payé / Prévu / Budget, reste par jour ; à la place du coût par jour : coût estimé des activités, reste à payer / réserver, déjà payées ; dernières dépenses. Aucune migration.
- v1.10.33 : globe 3D (Three.js, page publique globe.html) : fond animé de l'accueil et choix du pays dans l'assistant, avec zoom d'ouverture, nom du pays survolé au centre, noms voisins en transparence, fond étoilé, soleil, terre noire et contours turquoise. Nécessite internet (CDN three.js et world-atlas). Aucune migration.
- v1.10.34 : fiche lieu : bouton « Y aller · ≈ N min » (trajet le plus rapide depuis l'étape précédente, ou l'hébergement pour la première) qui ouvre Google Maps avec départ et arrivée. Aucune migration.
- v1.10.35 : assistant : l'écran Propositions n'est plus affiché deux fois ; globe : nom du pays en haut à gauche, pays voisins plus visibles, le globe pivote vers le pays choisi dans la liste ; vrais drapeaux (images flagcdn, les émojis s'affichent en lettres sous Windows) ; liste des pays repliée derrière un bouton. Aucune migration.
- v1.10.36 : étape Villes : carte du pays découpée en régions (données geoBoundaries niveau 1, fichiers `public/regions/XX.json` générés par `scripts/build-regions.py`, 193 pays) ; toucher une région zoome et montre ses villes populaires, les autres apparaissent au zoom ; toucher une ville l'ajoute au parcours ; liste des villes repliée derrière un bouton. Nécessite internet (MapLibre). Aucune migration.
- v1.10.37 : « Non prévu » (favoris pas encore planifiés, ajout à un jour en un geste) sur l'onglet Voyage ; code d'invitation affiché en grand avec Partager (copie sur le web) dans Amis ; « Rejoindre un voyage » avec un code sur l'accueil ; « Appliquer à tous les jours » pour les heures de départ et de retour. Aucune migration.
- v1.10.38 : carte : panneau des lieux glissant (bas / milieu / haut, on tire la poignée ou on la touche), aperçu au survol sur le web ; Jour : glisser-déposer au doigt sur téléphone (appui long puis glisser une étape sur une autre). Aucune migration.
- v1.10.39 : étape Villes sur grand écran (≥ 900 px) : la carte occupe ~70 % de la largeur (plus haute), colonne de droite (~30 %) avec « Ton parcours » (nuits − / +), recherche et liste ; largeur max de l’étape portée à 1320 px ; téléphone inchangé (empilé).
- v1.10.40 : météo : la dernière prévision connue est gardée sur l’appareil (AsyncStorage) et affichée hors connexion avec son heure de mise à jour. Aucune migration.
- v1.10.41 : « Partager le programme » (texte prêt à coller + agenda .ics sur le web, `domain/exportTrip.ts` testé) ; « Mot de passe oublié ? » sur la connexion, changement de mot de passe et « Supprimer mon compte » (confirmation par saisie) dans Paramètres. **Migration 1200** (`delete_my_account`) à exécuter dans Supabase pour activer la suppression ; sans elle, un message clair s’affiche. Le lien de réinitialisation renvoie vers l’adresse du site : à déclarer dans Supabase (Authentication → URL Configuration → Redirect URLs).
- v1.10.42 : « Réservations » (vols, trains, hébergements, billets : titre, n° de confirmation, date/heure, lien, notes ; visible de tous les voyageurs). **Migration 1300** (`trip_bookings`) à exécuter dans Supabase ; sans elle, un message clair s’affiche. Pièces jointes PDF : pas encore (un lien suffit pour l’instant).
- v1.10.43 : « À ne pas oublier » (liste à cocher partagée : bagages, papiers, démarches ; bouton « Ajouter les indispensables »). **Migration 1400** (`trip_checklist`) à exécuter dans Supabase ; sans elle, un message clair s’affiche.
- v1.10.44 : lecture hors connexion : le dernier état de chaque voyage ouvert et la liste des voyages sont gardés sur l’appareil (AsyncStorage, `data/offline.ts`, `domain/offlineSnapshot.ts` testé) et affichés quand le réseau manque, avec « Copie hors ligne · date ». Effacés à la déconnexion. Lecture seule : les modifications demandent le réseau. Aucune migration.
- v1.10.45 : rappels sur téléphone (expo-notifications, programmés sur l’appareil, aucun serveur) : la veille du départ à 18 h et 1 h avant la première activité horaire de chaque jour ; option « Rappels » dans Paramètres (demande l’autorisation), reprogrammés à l’ouverture/modification du voyage, coupés à la déconnexion. Pas de rappels sur le web. **Demande un nouvel APK** (module natif ajouté). Aucune migration.
- v1.10.46 : globe : la France se choisit enfin (les anciens codes FX, UK, SU… n’écrasent plus les vrais codes) ; planète réaliste (textures jsDelivr : jour, lumières de nuit, quelques nuages, halo bleu), jour à droite/au centre et nuit à gauche quelle que soit la rotation ; contours fins en données 50 m, nets au zoom ; cadre plus grand dans l’assistant ; plus de noms de pays voisins. Aucune migration.
- v1.10.47 : destinations réordonnées par glisser-déposer (flèches retirées) ; carte toujours en clair + bouton « Voir les détails » (fiche du lieu) ; fiche lieu : courte description (base ou Wikipédia, CC BY-SA) et « Entrée estimée » ; Budget : choisir une activité préremplit libellé, poste et montant estimé (× voyageurs) ; « Payé par » déjà masqué en solo. Aucune migration.
- v1.10.48 : choix du pays : planète en grand seule (la liste n'est plus dans la même page, donc plus de défilement parasite), bouton carré « ☰ » en haut à droite pour basculer vers la liste et « 🌍 » pour revenir ; étape Villes : même principe avec le pays en imagerie satellite réaliste (Sentinel-2 sans nuages, EOX, CC BY-NC : usage non commercial, comme Open-Meteo), reste de la carte assombri, bouton « ☰ » pour la liste des villes. Aucune migration.
- v1.10.49 : `public/_redirects` (réécriture vers index.html pour Netlify) : il est maintenant copié dans `dist` à chaque `npm run export:web`, plus besoin de le remettre à la main. Aucune migration.
- v1.10.50 : glisser-déposer animé et unifié (`DragList`, poignée ⠿, la ligne suit le doigt/la souris, les autres se décalent) pour les destinations (insertion) et les étapes du jour (échange), boutons Monter/Descendre retirés ; Voyage : carte « Horaires des activités » (`domain/hoursCheck.ts`) avec volet listant les problèmes (fermé, hors horaires, chevauchement), toucher une ligne ouvre le jour et met l'activité en évidence ; Jour : prix estimé à côté de chaque activité, alerte « hors horaires » ; Budget : carte « Activités à payer / réserver » avec bouton « Payé » (plus de préremplissage du formulaire) ; liste des lieux : icône de catégorie à la place de la pastille, marge en bas. Aucune migration.
- v1.10.51 : les lieux collectés n'ont aucun prix (OpenStreetMap n'en fournit pas) : estimation d'entrée par catégorie (`domain/priceEstimate.ts`, en euros, par personne) appliquée au chargement du voyage quand `price_amount` est vide ; un prix réel reste prioritaire. Alimente prix dans Jour, prévisions du Budget, détail du poste Activités et carte « Activités à payer / réserver ». Aucune migration.
- v1.10.52 : Budget : un seul affichage des activités à payer — le poste « Activités » ouvre la carte « Activités à payer / réserver » (reste à payer, boutons « Payé », « Déjà payées ») ; les deux autres listes sont supprimées. Aucune migration.
- v1.10.53 : assistant : lieux des villes chargés à la demande (état de collecte lu par ville, villes jamais collectées demandées, barre de progression en %) ; recherche de pays et bouton liste alignés, globe qui tient sans défilement ; carte des villes : masque du pays corrigé (contours fusionnés, plus de zones sombres par morceaux), icône ✈ pour les villes desservies (`domain/airports.ts`, données OurAirports) ; carte du voyage : attribution réduite. Aucune migration.
- v1.10.54 : sélecteur de jours (écran Voyage/Jour) : dans chaque cercle, le jour du mois et en dessous le mois abrégé (14 / oct) à la place du numéro et du jour de la semaine. Aucune migration.
