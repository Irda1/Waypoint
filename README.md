# Waypoint

**Le compagnon de voyage collaboratif** : prépare ton voyage à plusieurs, jour par jour, avec une carte, la météo et le partage des dépenses entre amis, même sans connexion.

> Principe : **l'IA propose, l'utilisateur décide.** Les estimations sont toujours marquées « ≈ », jamais de faux « temps réel ».

| | |
|---|---|
| 🌐 **Version web** | https://irda1.github.io/Waypoint/ |
| 📱 **APK Android** | [waypoint-app.apk](https://github.com/Irda1/Waypoint/releases/download/app-latest/waypoint-app.apk) (télécharge-le sur le téléphone, ouvre-le et autorise l'installation) |
| 📚 **Documentation** | [`docs/`](docs/) |

## Ce que fait l'application

- **Créer un voyage** avec un assistant : pays (planète 3D ou liste), dates, villes avec nuits réparties automatiquement, voyageurs, envies, budget, puis un programme jour par jour proposé.
- **Programme** : étapes avec horaires, glisser-déposer, vérification des horaires d'ouverture, plans B et C, « Journée en cours », fiche de chaque lieu (description, entrée estimée, durée, trajet).
- **Carte** : le programme numéroté par jour, des lieux à découvrir filtrables par catégorie, recherche, favoris, bouton « Élargir la zone » pour charger plus de lieux autour d'une ville.
- **Budget** : total, payé et prévu, reste par jour, détail par poste, par groupe ou par personne, et **« Entre amis »** (qui doit quoi, relancer, marquer reçu).
- **Voyager à plusieurs** : les membres sont égaux, on rejoint un voyage avec un code, une checklist « À ne pas oublier » est partagée, et un lien de partage en lecture seule existe.
- **Pratique** : météo avec cache hors connexion, lecture des voyages hors connexion, rappels sur téléphone, export texte et `.ics`, thème Nuit / Jour / Auto.

## Comment c'est fait

| Brique | Rôle |
|---|---|
| `apps/expo/` | L'application (Expo SDK 57, expo-router, React Native Web) : Android, iOS et web avec le même code. La logique métier pure et testée est dans `src/domain/`. |
| `supabase/` | La base de données (Postgres, sécurité par ligne, Realtime), les migrations et les tests de sécurité. |
| `pipeline/` | La collecte des données de référence (pays, villes, lieux, photos), lancée par GitHub Actions. |
| `.github/workflows/` | Publication du site web, de l'APK et collecte des données. |
| `web/`, `scripts/` | L'ancienne maquette (voir plus bas). |

**Sources de données** : [OpenStreetMap](https://www.openstreetmap.org/copyright) (lieux, ODbL), [Geoapify](https://www.geoapify.com/) (chargement rapide des lieux), GeoNames, Pexels (photos de villes), Wikipédia (descriptions, CC BY-SA), Open-Meteo (météo), OpenFreeMap (fond de carte), Frankfurter / BCE (taux de change). Détails et licences : [`docs/DESCRIPTION-TECHNIQUE.md`](docs/DESCRIPTION-TECHNIQUE.md).

## Lancer le projet

Prérequis : Node.js 22 ou plus et un projet [Supabase](https://supabase.com) (mise en route pas à pas : [`docs/BACKEND.md`](docs/BACKEND.md)).

```bash
cd apps/expo
cp .env.example .env.local      # puis renseigne l'URL et la clé « anon » de Supabase
npm install
npx expo start --web            # http://localhost:8081
```

Tests (depuis la racine du dépôt) :

```bash
cd apps/expo && npm test && npm run typecheck   # logique métier et typage
node --test pipeline/test/*.test.mjs            # collecte de données
bash supabase/tests/run-local.sh                # schéma et sécurité, sur un PostgreSQL jetable
```

## Publication

À chaque push sur `main` :

- le **site web** est reconstruit et publié sur GitHub Pages (`web-app.yml`) ;
- l'**APK** est construit et publié dans les Releases, avec un lien stable vers la dernière version (`apk-app.yml`) ;
- la **collecte de données** tourne régulièrement (`collecte.yml`).

Les migrations de la base ne sont pas automatiques : elles se collent dans le SQL Editor de Supabase (voir [`docs/BACKEND.md`](docs/BACKEND.md)).

## Travailler avec Claude Code

Le dépôt contient sa configuration pour les sessions Claude Code : [`CLAUDE.md`](CLAUDE.md) (consignes du projet), un hook de démarrage qui installe les dépendances, et des skills dans `.claude/skills/` (migrations Supabase, build de l'APK, et le mode « ponytail » qui privilégie le plus petit changement qui marche).

## Ancienne maquette (v0.9)

Avant l'application, une maquette interactive en un seul fichier HTML (`web/index.html`) a servi de prototype, publiée en APK via Capacitor (`publier.yml`). Elle ne reçoit plus d'évolutions. Description : [`docs/DESCRIPTION-TECHNIQUE.md`](docs/DESCRIPTION-TECHNIQUE.md). Pour la tester : `npm install && npm run build:web && npm run serve` (http://localhost:5173).

## État du projet

Projet personnel en cours de développement. Non vérifié sur appareil à ce jour : rappels natifs, mode hors connexion, glisser-déposer mobile. Les transports en commun sont estimés (pas encore de source réelle). L'offre gratuite d'Open-Meteo est réservée à un usage non commercial : à changer avant une publication commerciale.
