# Escale · maquette

Maquette interactive d'**Escale**, l'application compagnon de voyage (version actuelle : 0.8.3 « Carnet de nuit »).

À chaque `push` sur `main`, GitHub Actions publie automatiquement :

| Quoi | Où |
|---|---|
| Version web (installable, fonctionne hors ligne) | `https://<pseudo>.github.io/<dépôt>/` |
| Page d'installation (APK + web, QR code) | `https://<pseudo>.github.io/<dépôt>/installer.html` |
| Dernier APK Android | `https://github.com/<pseudo>/<dépôt>/releases/latest/download/escale.apk` |
| Historique des APK | onglet **Releases** du dépôt (une release `build-N` par publication) |

## Organisation du dépôt

```
web/                     Source de la maquette (ce qui est publié)
  index.html             La maquette (un seul fichier, issue de l'artifact Claude)
  installer.html         Page « Installer la maquette »
  pwa.js                 Service worker (web) + couleur de la barre d'état (APK)
  sw.js                  Cache hors ligne de la version web
  manifest.webmanifest   Nom, icônes, couleurs de l'appli web installable
  icons/                 Icônes web
resources/android/res/   Icônes Android, écran de lancement (copiés dans le projet natif par la CI)
scripts/
  build-web.mjs          web/ → dist/ (version, n° de build, liens du dépôt, QR code)
  serve.mjs              Serveur local pour tester dist/
  generate-icons.mjs     Régénère les icônes à partir du logo
capacitor.config.json    Configuration de l'APK (Capacitor 8)
.github/workflows/publier.yml   Publication web + APK
```

## Mettre à jour la maquette

1. Remplace `web/index.html` par la nouvelle version (garder les lignes du `<head>` : manifest, icônes, `pwa.js` en bas de page).
2. Monte la version dans `package.json` (`"version": "0.8.4"` par exemple).
3. `git commit` puis `git push` : environ 5 minutes plus tard, le site et l'APK sont à jour.

Sur le téléphone, le nouvel APK s'installe par-dessus l'ancien (même clé de signature, numéro de version croissant) : les voyages enregistrés sont conservés.

## Tester en local

```bash
npm install
npm run build:web
npm run serve          # http://localhost:5173
```

Pour ouvrir le projet Android dans Android Studio (facultatif) : `npm run android:add`, puis `npm run android:sync` et `npm run android:open`.

## Signature de l'APK

La CI signe l'APK avec la clé stockée dans le secret GitHub **`ANDROID_DEBUG_KEYSTORE`** (keystore encodé en base64). Sans ce secret, chaque build utiliserait une clé différente et il faudrait désinstaller l'appli avant chaque mise à jour. La clé n'est jamais versionnée (voir `.gitignore`).

Cette clé sert uniquement à la maquette (`com.escale.maquette`). La future application Play Store aura son propre identifiant et sa propre clé de publication.

## Limites connues de la maquette

- Données d'exemple : lieux, horaires, météo et trajets ne viennent d'aucune API réelle.
- Les voyages créés sont stockés localement (navigateur ou APK), sans compte ni synchronisation.
- Les polices Geist viennent de Google Fonts : sans réseau, l'APK peut afficher la police système à la place.
- L'APK est une build « debug » (non optimisée, non publiable sur le Play Store). C'est voulu pour une maquette.
