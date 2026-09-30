// Génère toutes les icônes (web + Android) à partir du logo Waypoint (identité v0.9 : dégradé crépuscule,
// tracé en pointillés, étape qui brille).
// Usage : npm i -D sharp && node scripts/generate-icons.mjs
//   (sans sharp, le script se rabat sur Playwright/Chromium s'il est installé)
// Les fichiers produits sont versionnés : ce script ne tourne pas dans la CI.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const CREME = "#FFF6E9", SOLEIL = "#FFB95A", NUIT = "#2A1B4D";

// Le signe est dessiné dans un carré 120×120 (boîte utile : x 23→105, y 15→99, centre 64,57).
const SIGNE = { largeur: 82, cx: 64, cy: 57 };
const signe = (taille, part) => {
  const k = (part * taille) / SIGNE.largeur, tx = taille / 2 - SIGNE.cx * k, ty = taille / 2 - SIGNE.cy * k;
  return `<g transform="translate(${tx} ${ty}) scale(${k})">
    <circle cx="30" cy="92" r="7" fill="${CREME}"/>
    <path d="M38 88Q62 90 66 66T88 34" fill="none" stroke="${CREME}" stroke-width="5" stroke-dasharray="1 11" stroke-linecap="round"/>
    <circle cx="90" cy="30" r="15" fill="${SOLEIL}"/><circle cx="90" cy="30" r="5.5" fill="${NUIT}"/></g>`;
};
const DEGRADE = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NUIT}"/><stop offset="0.6" stop-color="#C4506A"/><stop offset="1" stop-color="#F5A56A"/></linearGradient></defs>`;

// part = part de la largeur occupée par le signe ; forme = "carre" | "arrondi" | "rond" | "transparent"
function svg(taille, part, forme) {
  const fond = {
    carre: `<rect width="${taille}" height="${taille}" fill="url(#g)"/>`,
    arrondi: `<rect width="${taille}" height="${taille}" rx="${taille * 0.233}" fill="url(#g)"/>`,
    rond: `<circle cx="${taille / 2}" cy="${taille / 2}" r="${taille / 2}" fill="url(#g)"/>`,
    transparent: "",
  }[forme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">${DEGRADE}${fond}${signe(taille, part)}</svg>`;
}

// Rendu : sharp si présent, sinon Chromium via Playwright
let rendu;
try {
  const sharp = (await import("sharp")).default;
  rendu = { png: (source, taille, cible) => sharp(Buffer.from(source)).png().toFile(cible), fin: async () => {} };
} catch {
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch(), page = await navigateur.newPage();
  rendu = {
    png: async (source, taille, cible) => {
      await page.setViewportSize({ width: taille, height: taille });
      await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${source}`);
      await page.screenshot({ path: cible, omitBackground: true, clip: { x: 0, y: 0, width: taille, height: taille } });
    },
    fin: () => navigateur.close(),
  };
}

async function png(chemin, taille, part, forme) {
  const cible = join(racine, chemin);
  await mkdir(dirname(cible), { recursive: true });
  await rendu.png(svg(taille, part, forme), taille, cible);
}

// ---- web
await png("web/icons/icon-192.png", 192, 0.66, "arrondi");
await png("web/icons/icon-512.png", 512, 0.66, "arrondi");
await png("web/icons/maskable-512.png", 512, 0.5, "carre");
await png("web/icons/apple-touch-icon.png", 180, 0.56, "carre");
await png("web/icons/favicon-32.png", 32, 0.78, "arrondi");
await writeFile(join(racine, "web/icons/logo.svg"), svg(64, 0.7, "arrondi"));

// ---- appli Expo (icône, icône adaptative Android, favicon, écran de démarrage)
await png("apps/expo/assets/icon.png", 1024, 0.62, "carre");
await png("apps/expo/assets/adaptive-icon.png", 1024, 0.44, "transparent");
await png("apps/expo/assets/splash-icon.png", 512, 0.9, "transparent");
await png("apps/expo/assets/favicon.png", 48, 0.78, "arrondi");
await png("apps/expo/assets/logo.png", 192, 0.84, "arrondi");

// ---- Android (copiées par la CI par-dessus le projet généré par Capacitor)
const res = "resources/android/res";
const densites = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densites)) {
  await png(`${res}/mipmap-${d}/ic_launcher.png`, 48 * k, 0.62, "arrondi");
  await png(`${res}/mipmap-${d}/ic_launcher_round.png`, 48 * k, 0.56, "rond");
  // Icône adaptative : calque 108 dp, zone sûre ≈ 66 dp au centre (le fond dégradé est dans drawable/ic_launcher_fond.xml).
  await png(`${res}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, 0.44, "transparent");
}
await png(`${res}/drawable-nodpi/waypoint_logo.png`, 288, 0.66, "arrondi");
await rendu.fin();
console.log("Icônes générées.");
