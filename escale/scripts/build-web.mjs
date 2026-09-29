// Construit la version publiée : copie web/ → dist/ et remplace les marqueurs
// (__ESCALE_VERSION__, __ESCALE_BUILD__, …) par les infos de la publication.
// dist/ sert à la fois pour GitHub Pages et comme contenu de l'APK (Capacitor).
// Aucune dépendance obligatoire : « qrcode » est facultatif (QR de la page Installer).
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(racine, "web");
const sortie = join(racine, "dist");

const pkg = JSON.parse(await readFile(join(racine, "package.json"), "utf8"));
const depot = process.env.GITHUB_REPOSITORY || "TON-PSEUDO/escale";
const [proprio, nomDepot] = depot.split("/");
const urlPages = process.env.ESCALE_PAGES_URL ||
  (nomDepot.toLowerCase() === `${proprio.toLowerCase()}.github.io`
    ? `https://${proprio.toLowerCase()}.github.io/`
    : `https://${proprio.toLowerCase()}.github.io/${nomDepot}/`);
const build = process.env.GITHUB_RUN_NUMBER || "local";
const date = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });

let qr = "";
try {
  const QRCode = (await import("qrcode")).default;
  qr = await QRCode.toString(`${urlPages}installer.html`, {
    type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#080B0C", light: "#F5F5F2" },
  });
  qr = qr.replace("<svg ", '<svg role="img" aria-label="QR code vers la page d\'installation" ');
} catch {
  console.warn("· qrcode absent : la page Installer sera publiée sans QR code.");
}

const marqueurs = {
  __ESCALE_VERSION__: pkg.version,
  __ESCALE_BUILD__: build,
  __ESCALE_DATE__: date,
  __ESCALE_REPO__: depot,
  __ESCALE_PAGES_URL__: urlPages,
  __ESCALE_QR__: qr,
};
const aTraiter = new Set([".html", ".js", ".webmanifest", ".json"]);

async function fichiers(dossier) {
  const liste = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) liste.push(...(await fichiers(chemin)));
    else liste.push(chemin);
  }
  return liste;
}

await rm(sortie, { recursive: true, force: true });
await mkdir(sortie, { recursive: true });
await cp(source, sortie, { recursive: true });

for (const f of await fichiers(sortie)) {
  if (!aTraiter.has(extname(f))) continue;
  let texte = await readFile(f, "utf8");
  const avant = texte;
  for (const [cle, valeur] of Object.entries(marqueurs)) texte = texte.split(cle).join(valeur);
  if (texte !== avant) await writeFile(f, texte);
}

await writeFile(join(sortie, "version.json"), JSON.stringify({ version: pkg.version, build, depot, date: new Date().toISOString() }, null, 2) + "\n");
console.log(`Escale ${pkg.version} (build ${build}) → dist/ · ${urlPages}`);
