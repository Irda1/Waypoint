// Génère toutes les icônes (web + Android) à partir du logo Escale.
// Usage : npm i -D sharp && node scripts/generate-icons.mjs
// Les fichiers produits sont versionnés : ce script ne tourne pas dans la CI.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOND = "#080B0C";
const ACCENT = "#63D6C5";

// Logo (boussole) dessiné dans un carré 24×24, comme dans la maquette.
const logo = (couleur) => `
  <circle cx="12" cy="12" r="8.5" fill="none" stroke="${couleur}" stroke-width="1.7"/>
  <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="${couleur}" stroke="${couleur}" stroke-width="1.2" stroke-linejoin="round"/>`;

// part = part du côté occupée par le logo ; forme = "carre" | "arrondi" | "rond" | "transparent"
function svg(taille, part, forme) {
  const l = taille * part, o = (taille - l) / 2, s = l / 24;
  const fond = {
    carre: `<rect width="${taille}" height="${taille}" fill="${FOND}"/>`,
    arrondi: `<rect width="${taille}" height="${taille}" rx="${taille * 0.225}" fill="${FOND}"/>`,
    rond: `<circle cx="${taille / 2}" cy="${taille / 2}" r="${taille / 2}" fill="${FOND}"/>`,
    transparent: "",
  }[forme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">${fond}<g transform="translate(${o} ${o}) scale(${s})">${logo(ACCENT)}</g></svg>`;
}

async function png(chemin, taille, part, forme) {
  const cible = join(racine, chemin);
  await mkdir(dirname(cible), { recursive: true });
  await sharp(Buffer.from(svg(taille, part, forme))).png().toFile(cible);
}

// ---- web
await png("web/icons/icon-192.png", 192, 0.56, "arrondi");
await png("web/icons/icon-512.png", 512, 0.56, "arrondi");
await png("web/icons/maskable-512.png", 512, 0.5, "carre");
await png("web/icons/apple-touch-icon.png", 180, 0.52, "carre");
await png("web/icons/favicon-32.png", 32, 0.78, "arrondi");
await writeFile(join(racine, "web/icons/logo.svg"), svg(64, 0.7, "arrondi"));

// ---- Android (copiées par la CI par-dessus le projet généré par Capacitor)
const res = "resources/android/res";
const densites = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densites)) {
  await png(`${res}/mipmap-${d}/ic_launcher.png`, 48 * k, 0.56, "arrondi");
  await png(`${res}/mipmap-${d}/ic_launcher_round.png`, 48 * k, 0.52, "rond");
  // Icône adaptative : calque 108 dp, zone sûre ≈ 66 dp au centre.
  await png(`${res}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, 0.46, "transparent");
}
await png(`${res}/drawable-nodpi/escale_logo.png`, 288, 1, "transparent");
console.log("Icônes générées.");
