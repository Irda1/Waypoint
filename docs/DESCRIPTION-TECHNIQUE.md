# Waypoint · description technique (v0.9 + backend v1)

Ce document sépare trois choses : **ce qui existe aujourd'hui** (la maquette), **ce qui est proposé** pour l'application réelle, et **ce qui reste à vérifier**. Une donnée ou une API n'est jamais présentée comme disponible sans avoir été contrôlée (règle du projet).

## 1. Ce qui existe aujourd'hui : une maquette sans backend ni API

### Langages et format
- **HTML / CSS / JavaScript « vanilla »**, sans framework ni bibliothèque, dans **un seul fichier** : `web/index.html` (≈ 3 700 lignes, 1,2 Mo, photos incluses en base64).
- **Node.js ≥ 22** (modules ES) pour les scripts de build : `scripts/build-web.mjs` (copie `web/` vers `dist/` et injecte version, numéro de build, liens du dépôt), `serve.mjs` (serveur local), `generate-icons.mjs` (icônes).
- **YAML** pour la CI GitHub Actions (`.github/workflows/publier.yml`).

### Application installable
- **PWA** : `manifest.webmanifest` + `sw.js` (service worker : réseau d'abord, cache en secours, donc utilisable hors ligne pour ce qui a déjà été ouvert).
- **APK Android** : **Capacitor 8** enveloppe la même page web dans une WebView Android (`appId com.waypoint.maquette`, minSdk 24, cible SDK 36). Le projet Android est généré à chaque build par `npx cap add android`, compilé par **Gradle 8.14 / AGP 8.13 / JDK 21**, signé avec une clé stockée dans le secret GitHub `ANDROID_DEBUG_KEYSTORE`. C'est une build *debug* : suffisante pour la maquette, pas publiable sur le Play Store.
- **Hébergement et distribution** : dépôt GitHub `Irda1/Waypoint` ; **GitHub Pages** pour la version web ; **GitHub Releases** pour l'APK (une release `build-N` à chaque push sur `main`).

### Design
- Système « Crépuscule » (v0.9) : fond nuit `#07090B`, crème `#FFF6E9` en mode Jour, accent **Soleil** par défaut (Turquoise, Corail, Lavande au choix), titres **Fraunces**, texte **Plus Jakarta Sans**, chiffres **Geist Mono** (polices chargées depuis Google Fonts ; sans réseau, police système). Icônes = SVG « trait » dessinés dans le fichier.
- La carte est un **dessin SVG fait main** (contours simplifiés de Lisbonne, Porto, Tokyo…), sans tuiles ni fournisseur de cartes.

### D'où viennent les données aujourd'hui
**Toutes les données sont écrites en dur dans `index.html`. Aucune API n'est appelée.**

| Donnée | Source actuelle |
|---|---|
| 89 activités (musées, restaurants, ateliers…) dans 15 villes ; 60 villes proposables | Liste saisie à la main (noms, coordonnées approximatives, durée, prix, horaires, jours de fermeture) : **exemples**, pas des données vérifiées |
| 28 services (pharmacies, banques, distributeurs, hôpitaux, toilettes, laveries) à Lisbonne, Porto et Tokyo | Emplacements **d'exemple** avec noms génériques (« Pharmacie · Chiado »), aucune enseigne réelle |
| Météo, trajets, temps de marche | Valeurs d'exemple ; les trajets sont estimés à vol d'oiseau × 1,3 |
| Photos | 6 photos d'ambiance fournies par Adrien, recadrées ; les lieux affichent un emplacement rayé |
| Voyages, dépenses, hébergements, réglages | `localStorage` du navigateur ou de l'APK (clés `waypoint.maquette.voyages`, `waypoint.maquette.apparence.v09`). Ni compte, ni synchronisation |
| Itinéraires « Y aller » | Simples **liens Google Maps** (format officiel *Maps URLs*, sans clé) ; rien n'est calculé par Google dans l'appli |

Le prototype backend de la v0.5 (FastAPI + SQLite + JWT, thèmes, comptes, préférences) n'est **pas** dans le dépôt actuel.

## 2. Ce que la maquette gère côté logique (déjà codé, testé dans Chromium)
Planification d'une journée (heures, durées, trajets, horaires d'ouverture, jours de fermeture), plans B et C, glisser-déposer, budget (payé / prévu / dépassement, par poste, par personne, soldes entre amis), paiements par activité, séjours avec heures de départ et de retour.

**Nouveautés v0.9**
- **Carte, filtre « Pratique »** : pharmacies, banques, distributeurs, hôpitaux, toilettes, laveries. Ce ne sont pas des activités : ils n'entrent ni dans les envies, ni dans les suggestions, ni dans l'itinéraire. La recherche « pharma » les trouve aussi depuis « Tout ».
- **Onglet Jour** : plus de libellé de catégorie, seulement l'icône ; dollar **plein vert** = payé, **contour vert** = acompte, **gris** = pas encore payé (rien si l'activité est gratuite).
- **Hébergement** : champ « Prix payé » (et « Payé par ») qui crée ou met à jour une dépense du poste Hébergement, rattachée au séjour, donc comptée dans le budget.

## 3. Architecture choisie pour l'application réelle (v1, voir `docs/BACKEND.md`)

Les choix ci-dessous ont été tranchés ; leur mise en route est décrite dans `docs/BACKEND.md`.

| Couche | Choix | Où |
|---|---|---|
| Application | **Expo (React Native + react-native-web + Expo Router)** : un seul code pour Android, iOS et web, TypeScript | `apps/expo/` |
| Logique métier | Budget, soldes entre amis, pastille de paiement, planning d'une journée : portés de la maquette en TypeScript pur, testés avec Node | `apps/expo/src/domain/` |
| Backend et base | **Supabase** : PostgreSQL, authentification (email + Google), Realtime, sécurité par ligne, stockage | `supabase/migrations/` |
| Collecte | Scripts Node sans dépendance (GeoNames, OpenStreetMap/Overpass, Pexels), lancés par GitHub Actions ou depuis une machine, écrivant avec la clé de service | `pipeline/`, `.github/workflows/collecte.yml` |
| Voyages partagés | Membres tous égaux (aucun rôle), modifications en direct, dernier écrit gagne champ par champ, numéro de version par ligne, journal des modifications | tables `trips`, `trip_members`, `trip_days`, `trip_items`, `expenses`, `trip_activity_log`… |
| IA | Couche au-dessus de données structurées (l'IA propose, l'utilisateur décide) | Phase 3 ; non commencée |

La maquette (`web/`, Capacitor) reste la référence d'écrans et de logique ; elle continue d'être publiée sur GitHub Pages et en APK.

## 4. Sources de données possibles (avec ce qui a été vérifié)

Vérifications faites sur les pages officielles le 29/09/2026. **Tout ce qui n'est pas marqué « vérifié » reste à contrôler avant décision.**

### Lieux et services utiles (restaurants, pharmacies, banques, distributeurs…)
- **OpenStreetMap via l'API Overpass** : les pharmacies, banques, distributeurs, hôpitaux, toilettes et laveries y sont des objets standards (étiquettes du type `amenity=pharmacy`, `amenity=bank`, `amenity=atm`). Gratuit, sans clé. *Vérifié* : licence **ODbL** (attribution obligatoire) ; l'instance publique demande un `User-Agent`, tolère à peu près 10 000 requêtes/jour pour un usage occasionnel mais **≈ 100 requêtes/jour pour une application régulière**, et est signalée comme souvent surchargée. Conclusion : bien pour prototyper, pas pour la production sans instance dédiée, extraits de données ou fournisseur commercial. La couverture varie selon les pays (à mesurer sur Lisbonne, Porto, Tokyo).
- **Google Places API (New)** : données très complètes (horaires, avis, photos). *Vérifié* : facturation par « SKU » (Essentials / Pro / Enterprise) selon les champs demandés (masque de champs obligatoire), facturée au niveau le plus élevé des champs demandés. *Non vérifié ici* : les prix par 1 000 requêtes, le crédit gratuit mensuel actuel, les règles de mise en cache. À lire sur la page tarifaire officielle avant tout calcul.
- **Foursquare Places API** : alternative commerciale ; un modèle « pay as you go » existe. *Non vérifié* : tarifs, quotas, conditions d'affichage.
- **Ateliers créatifs (chaussures, poterie, cuisine…)** : aucune API générique fiable connue. Pistes : liste éditoriale maison, recherche textuelle Google Places, étiquettes OSM (`craft=*`, `shop=*`), plateformes d'activités avec programme partenaire (à étudier, non vérifiées). C'est la fonction la plus différenciante du produit ; prévoir de la curer à la main pour les premières villes.

### Villes, pays, géocodage
- **Nominatim (OpenStreetMap)** pour transformer un nom de ville en coordonnées. *Vérifié* : **1 requête par seconde maximum**, `User-Agent` identifiant l'application obligatoire, **autocomplétion interdite** côté client, mise en cache des résultats exigée, attribution ODbL. Un usage modéré déclenché par l'utilisateur est toléré ; une application dont la fonction principale est le géocodage doit héberger son propre service. Conséquence : pour la saisie « ville » avec suggestions, prévoir un autre fournisseur ou une instance dédiée.
- Pour les 60 villes de la maquette, les coordonnées sont déjà saisies ; une liste fixe de destinations populaires peut rester locale dans l'application.

### Météo
- **Open-Meteo** : prévisions horaires et quotidiennes sans clé pour l'offre gratuite. *Vérifié* : gratuit pour **usage non commercial** avec 600 appels/minute, 5 000/heure, 10 000/jour, données sous **CC BY 4.0** (attribution) ; un **abonnement payant est requis** pour un produit commercial, un site avec publicité ou abonnements. Pour une application publiée sur le Play Store avec monétisation, prévoir l'offre payante ou un autre fournisseur.

### Transports et trafic
- **Transports en commun** : le standard est **GTFS** (horaires) et **GTFS-Realtime** (retards, perturbations), publiés opérateur par opérateur ou par ville. La disponibilité, la licence et la fraîcheur diffèrent partout (Lisbonne, Porto, Tokyo…). *Non vérifié.* Règle produit : l'application doit afficher clairement « temps réel » (source garantie), « estimé » ou « source externe ».
- **Trafic routier** : aucune source choisie. Les fournisseurs grand public sont payants ; à traiter en phase 2.

### Carte
- Aujourd'hui : dessin SVG. Pour la vraie carte : **MapLibre** (moteur open source) + tuiles vectorielles d'un fournisseur, ou le SDK Google Maps. *Non vérifié ici* : tarifs, limites des tuiles. Les serveurs de tuiles publics d'OpenStreetMap ne sont pas destinés à un usage applicatif intensif.

## 5. Recommandation de parcours (MVP)
1. Garder la maquette comme référence d'écrans et de logique.
2. Prototyper la couche « lieux » sur **OSM/Overpass** pour deux villes (Lisbonne, Porto) : mesurer la qualité (services utiles, horaires renseignés ou non, noms).
3. Choisir Open-Meteo (offre adaptée au modèle économique) ou un autre fournisseur météo.
4. Trancher Kotlin/Compose ou Flutter, puis le backend.
5. Ajouter les transports et le trafic seulement après la carte, les lieux et l'itinéraire réels (phase 2).

## 6. Limites connues de la maquette
- Données d'exemple : ne jamais s'y fier pour un vrai voyage (horaires, prix, emplacements).
- Les polices et l'éventuel QR code de la page Installer dépendent d'un accès réseau.
- Un séjour d'hébergement scindé en deux après un paiement saisi garde le paiement sur l'ancien séjour (choix volontaire pour ne pas compter deux fois).
- Les émojis « Système / Noto / Twemoji » du canvas v0.9 ne sont pas repris : la maquette garde ses icônes SVG « trait ».
