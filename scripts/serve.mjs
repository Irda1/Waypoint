// Petit serveur local sans dépendance pour tester dist/ : npm run serve → http://localhost:5173
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT) || 5173;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let chemin = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    let fichier = join(racine, chemin);
    if (!fichier.startsWith(racine)) throw new Error("hors de dist/");
    if ((await stat(fichier).catch(() => null))?.isDirectory()) fichier = join(fichier, "index.html");
    const corps = await readFile(fichier);
    res.writeHead(200, { "Content-Type": types[extname(fichier)] || "application/octet-stream" });
    res.end(corps);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Introuvable");
  }
}).listen(port, () => console.log(`Waypoint sur http://localhost:${port}`));
