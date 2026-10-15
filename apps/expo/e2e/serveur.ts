// Faux serveur des tests de parcours. Le site est construit avec l'adresse https://e2e.supabase.co : chaque test
// répond lui-même à ses appels (tables lues dans `tables`, fonctions dans `rpc`) et récupère les écritures envoyées.
// Tout le reste d'Internet (cartes, photos, météo) est coupé : les tests sont rapides et donnent toujours le même résultat.
import type { Page } from '@playwright/test';

export const USER = 'aaaaaaaa-0000-0000-0000-000000000001';
export const TRIP = 'c6000000-0000-0000-0000-000000000001';
export const dayId = (n: number) => `c7000000-0000-0000-0000-00000000000${n}`;
/** Date dans `n` jours (« AAAA-MM-JJ »). */
export const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const user = { id: USER, email: 'parcours@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: { display_name: 'Adrien' }, app_metadata: {} };

/** Session déjà ouverte (le faux serveur ne vérifie rien) et écran d'accueil déjà vu ; `extra` : autres valeurs gardées sur l'appareil. */
export async function signIn(page: Page, extra: Record<string, string> = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const session = { access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: USER, exp, role: 'authenticated' })}.x`, refresh_token: 'r', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
  await page.addInitScript((items) => { for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v); },
    { 'sb-e2e-auth-token': JSON.stringify(session), 'waypoint.welcomed': '1', ...extra });
}

export interface Write { method: string; table: string; query: string; body: unknown }
/** Lignes d'une table : toujours les mêmes, ou choisies d'après les filtres de la demande (`city_id=eq.1`…). */
export type Rows = unknown[] | ((query: URLSearchParams) => unknown[]);

/** Branche le faux serveur ; renvoie les écritures reçues (ajouts, modifications, suppressions), dans l'ordre. */
export async function fakeServer(page: Page, tables: Record<string, Rows>, rpc: Record<string, unknown> = {}): Promise<Write[]> {
  const writes: Write[] = [];
  await page.routeWebSocket(/.*/, (ws) => ws.close());
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost') return route.continue();
    if (url.hostname !== 'e2e.supabase.co') return route.abort();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname === '/auth/v1/user') return json(user);
    const path = url.pathname.replace(/^\/rest\/v1\//, '');
    if (path.startsWith('rpc/')) {
      const name = path.slice(4);
      return name in rpc ? json(rpc[name]) : json({ code: 'PGRST202', message: `Could not find the function ${name}` }, 404);
    }
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      const body = req.postData() ? JSON.parse(req.postData()!) : null;
      writes.push({ method: req.method(), table: path, query: decodeURIComponent(url.search), body });
      return json(body ?? [], 201);
    }
    const table = tables[path] ?? [];
    const rows = typeof table === 'function' ? table(url.searchParams) : table;
    // `.single()` et `.maybeSingle()` demandent un objet, le reste une liste.
    if ((req.headers().accept ?? '').includes('vnd.pgrst.object')) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
    return json(rows);
  });
  return writes;
}
