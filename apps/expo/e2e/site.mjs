// Sert le site construit (dossier dist) comme GitHub Pages : une adresse inconnue (/trip/…, /share/…) renvoie l'appli.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  let file = join(root, normalize(decodeURIComponent(new URL(req.url, 'http://site').pathname)));
  let body = await readFile(file).catch(() => null);
  if (!body) body = await readFile((file = join(root, 'index.html')));
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
}).listen(4173);
