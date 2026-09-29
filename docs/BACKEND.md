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

**Polices** : le thème prévoit Fraunces, Plus Jakarta Sans et Geist Mono ; elles ne sont pas encore chargées (l'appli utilise les polices du système en attendant). À ajouter avec `expo-font` à l'étape suivante.

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
- **Tables ajoutées** au plan : `place_categories` (les catégories évoluent par simple ajout de ligne), `ingestion_queue` (collecte à la demande), `trip_budget_lines` (budget prévu par poste). `place_translations`, `weather_cache`, `exchange_rates`, `attachments`, `push_tokens` et `data_requests` restent pour plus tard.
- **Suppressions et temps réel** : Supabase ne contrôle pas les suppressions avec les règles de sécurité et ne les filtre pas par voyage. L'appli écoute donc sans filtre (la sécurité par ligne limite déjà les ajouts et modifications aux voyages dont on est membre) et ne recharge sur une suppression que si elle concerne une ligne qu'elle connaît. Les tables gardent l'identité de réplique par défaut (clé primaire seule) pour ne rien diffuser du contenu supprimé.
- **Voyage supprimé** : corbeille (`deleted_at`) plutôt que suppression définitive depuis l'appli, puisqu'aucun membre n'a plus de droits que les autres.
- **Membre qui quitte** : `left_at` plutôt qu'une suppression, pour que ses dépenses avancées restent à son nom dans les comptes.

## Ce qui n'a pas pu être vérifié dans cet environnement

- La migration PostGIS (`…0700_postgis.sql`, fonction `places_nearby`) : PostGIS n'était pas installé dans l'environnement de test ; le reste du schéma est testé sur un vrai PostgreSQL 16. À valider en exécutant les migrations sur ton projet Supabase, puis `select * from places_nearby(38.72, -9.14, 1000);` après une collecte.
- Les formats des fichiers GeoNames sont écrits d'après leur documentation ; les analyseurs vérifient le nombre de colonnes et s'arrêtent si le format change. Un premier essai réel avec `cities --country PT --dry-run` confirmera.
- L'application Expo n'a pas pu être compilée ni lancée ici (pas d'accès aux paquets npm) : sa logique métier est testée, le code des écrans a seulement été relu et vérifié par le compilateur TypeScript pour les erreurs internes. Prévois un premier passage `npm install`, `npx expo install --fix`, `npx expo start` et corrige les éventuelles différences de version.
- Ni Bright Data ni les API de collecte n'étaient joignables ici : les passes sont testées contre de faux serveurs, jamais contre les vrais.
- Les tarifs Supabase et Google Places, et les conditions d'usage de Pexels pour l'affichage des photos par lien, sont à relire avant l'ouverture au public.

## Prochaines étapes

1. Premier déploiement : projet Supabase, migrations, secrets, passes `countries`, `cities`, puis `places` pour Lisbonne et Porto.
2. Recherche et ajout de lieux réels dans un jour (aujourd'hui l'appli ajoute des étapes libres), filtre « Pratique », carte.
3. Portage des écrans de la maquette (accueil, itinéraire, budget) avec le thème Crépuscule et les polices.
4. Météo, puis transports, seulement après lieux et carte réels.
