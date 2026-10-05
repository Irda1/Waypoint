---
name: apk-build
description: Construire, publier ou dépanner l'APK Android de Waypoint (workflow apk-app.yml, Expo prebuild, Gradle, release app-latest, secrets). À utiliser pour toute question ou modification liée à l'APK, à la signature ou à la version Android.
---

# APK Android de Waypoint

L'APK est construit **uniquement par GitHub Actions** (`.github/workflows/apk-app.yml`), pas en local. Pas de SDK Android dans la session cloud.

## Fonctionnement
- Déclencheur : push sur `main` touchant `apps/expo/**` ou le workflow, ou lancement manuel (Actions > « APK de l'appli » > Run workflow).
- Étapes : secrets vérifiés → Node 22 + Java 17 → `npm install` → `npx expo prebuild --platform android` → `versionCode` = numéro de run → lint désactivé → clé de signature → `gradlew assembleRelease` → Release `app-N` + release `app-latest` recréée.
- Identifiant : `com.waypoint.app` (`apps/expo/app.json`). `apps/expo/android/` est généré, ignoré par git : ne pas le versionner.
- Lien stable : https://github.com/Irda1/Waypoint/releases/download/app-latest/waypoint-app.apk
- Secrets Actions : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publique), `ANDROID_DEBUG_KEYSTORE` (base64, garde la même signature pour que l'APK s'installe par-dessus l'ancien). Sans ce dernier : clé de test, donc mise à jour impossible par-dessus une autre signature.

## Avant de pousser un changement d'appli
`cd apps/expo && npm test && npm run typecheck` (aussi `npm run export:web` si l'écran existe en web). Une régression vue ici évite 10+ minutes de CI perdue.

## Dépannage
- **Échec « Secret … absent »** : Settings > Secrets and variables > Actions, ajouter le secret (dire à Adrien où cliquer ; ne jamais lire ni écrire sa valeur).
- **Échec Gradle / prebuild** : récupérer le journal du job via les outils GitHub MCP (`get_job_logs`), chercher la première vraie erreur, pas la dernière. Souvent une dépendance native ajoutée sans `expo install` ou une version Expo incompatible.
- **« App non installée » sur le téléphone** : signature différente de l'ancienne (secret keystore changé) ou versionCode inférieur. Désinstaller l'ancienne version (perd les données locales) ou rétablir la bonne clé.
- **Lien `app-latest` périmé** : la release est recréée à chaque build ; vérifier que le dernier run est vert.
- Non vérifié sur appareil à ce jour : rappels natifs, hors connexion, glisser-déposer mobile. Ne pas affirmer « marche sur téléphone » sans retour d'Adrien.

## Ne jamais
Écrire la keystore ou une clé dans le dépôt (`*.keystore`, `*.jks` sont ignorés) · lancer un workflow en boucle pour « voir » · changer l'identifiant `com.waypoint.app`.
